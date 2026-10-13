package org.meshaid.nativebridge

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.FileProvider
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class MeshNativeModule : Module() {
 private val context get()=requireNotNull(appContext.reactContext){"React context unavailable"}
 private val client get()=Nearby.getConnectionsClient(context)
 private val db by lazy {MeshDatabase(context)}
 private val handler=Handler(Looper.getMainLooper())
 private val connected=ConcurrentHashMap.newKeySet<String>()
 private val names=ConcurrentHashMap<String,String>()
 private val pending=ConcurrentHashMap<Long,Pair<String,Promise>>()
 private var advertisingName=""
 private val serviceId="org.meshaid.review1.mesh.v1"
 private fun emit(kind:String,id:String,name:String="",code:String="") {
  sendEvent("peer",mapOf("kind" to kind,"endpointId" to id,"name" to name,"code" to code))
 }
 private fun finish(payloadId:Long,error:String?=null){val entry=pending.remove(payloadId)?:return;if(error==null)entry.second.resolve(null)else entry.second.reject("SEND_FAILED",error,null)}
 private val payloadCallback=object:PayloadCallback(){
  override fun onPayloadReceived(endpointId:String,payload:Payload){
   if(!connected.contains(endpointId)||payload.type!=Payload.Type.BYTES)return
   val bytes=payload.asBytes()?:return
   if(bytes.size>8192){sendEvent("error",mapOf("message" to "Oversized radio payload rejected"));return}
   sendEvent("payload",mapOf("endpointId" to endpointId,"raw" to bytes.toString(Charsets.UTF_8),"wallTimeMs" to System.currentTimeMillis().toDouble(),"monotonicMs" to SystemClock.elapsedRealtimeNanos()/1e6))
  }
  override fun onPayloadTransferUpdate(endpointId:String,update:PayloadTransferUpdate){
   when(update.status){
    PayloadTransferUpdate.Status.SUCCESS -> finish(update.payloadId)
    PayloadTransferUpdate.Status.FAILURE -> finish(update.payloadId,"Nearby transfer failed")
    PayloadTransferUpdate.Status.CANCELED -> finish(update.payloadId,"Nearby transfer cancelled")
   }
  }
 }
 private val lifecycle=object:ConnectionLifecycleCallback(){
  override fun onConnectionInitiated(id:String,info:ConnectionInfo){
   names[id]=info.endpointName
   // Both users compare this code before accepting. This is transport pairing, not Ed25519/TOFU.
   emit("pairing",id,info.endpointName,info.authenticationDigits)
  }
  override fun onConnectionResult(id:String,result:ConnectionResolution){
   if(result.status.isSuccess){connected.add(id);emit("connected",id,names[id]?:id)}
   else {connected.remove(id);emit("rejected",id,names[id]?:id);sendEvent("error",mapOf("message" to "Connection failed: ${result.status.statusCode}"))}
  }
  override fun onDisconnected(id:String){connected.remove(id);emit("disconnected",id,names[id]?:id);pending.filterValues{it.first==id}.keys.forEach{finish(it,"Peer disconnected")}}
 }
 private val discovery=object:EndpointDiscoveryCallback(){
  override fun onEndpointFound(id:String,info:DiscoveredEndpointInfo){names[id]=info.endpointName;emit("found",id,info.endpointName)}
  override fun onEndpointLost(id:String){if(!connected.contains(id)){emit("lost",id,names[id]?:id);names.remove(id)}}
 }
 override fun definition()=ModuleDefinition {
  Name("MeshNative")
  Events("peer","payload","error")
  Function("uuid"){UUID.randomUUID().toString()}
  Function("monotonicMs"){SystemClock.elapsedRealtimeNanos()/1e6}
  AsyncFunction("getFanout"){
   context.getSharedPreferences("mesh-settings",0).getInt("fanout",0)
  }
  AsyncFunction("setFanout"){k:Int ->
   require(k in 0..16){"Neighbour limit must be All (0) or 1–16"}
   check(context.getSharedPreferences("mesh-settings",0).edit().putInt("fanout",k).commit()){"Cannot save neighbour limit"}
  }
  AsyncFunction("identity"){
   val prefs=context.getSharedPreferences("mesh-identity",0)
   var id=prefs.getString("nodeId",null)
   if(id==null){id=UUID.randomUUID().toString();check(prefs.edit().putString("nodeId",id).commit()){"Cannot save node identity"}}
   id
  }
  AsyncFunction("start"){name:String,promise:Promise ->
   check(GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)==ConnectionResult.SUCCESS){"Compatible Google Play services are required on this phone"}
   advertisingName=name.take(80)
   client.startAdvertising(advertisingName,serviceId,lifecycle,AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
    .addOnSuccessListener {
     client.startDiscovery(serviceId,discovery,DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
      .addOnSuccessListener{promise.resolve(null)}
      .addOnFailureListener{client.stopAdvertising();promise.reject("DISCOVERY_FAILED",it.message,it)}
    }.addOnFailureListener{promise.reject("ADVERTISING_FAILED",it.message,it)}
  }
  AsyncFunction("requestConnection"){id:String,promise:Promise ->
   client.requestConnection(advertisingName,id,lifecycle).addOnSuccessListener{promise.resolve(null)}.addOnFailureListener{promise.reject("CONNECT_FAILED",it.message,it)}
  }
  AsyncFunction("accept"){id:String,promise:Promise ->
   client.acceptConnection(id,payloadCallback).addOnSuccessListener{promise.resolve(null)}.addOnFailureListener{promise.reject("PAIR_FAILED",it.message,it)}
  }
  AsyncFunction("reject"){id:String,promise:Promise ->
   client.rejectConnection(id).addOnSuccessListener{promise.resolve(null)}.addOnFailureListener{promise.reject("REJECT_FAILED",it.message,it)}
  }
  AsyncFunction("disconnect"){id:String ->client.disconnectFromEndpoint(id);connected.remove(id);emit("disconnected",id,names[id]?:id)}
  AsyncFunction("pauseDiscovery"){client.stopDiscovery()}
  AsyncFunction("send"){id:String,raw:String,promise:Promise ->
   val bytes=raw.toByteArray(Charsets.UTF_8)
   if(!connected.contains(id))promise.reject("NOT_CONNECTED","Peer is not connected",null)
   else if(bytes.size>8192)promise.reject("TOO_LARGE","Payload exceeds 8 KB",null)
   else {
    val payload=Payload.fromBytes(bytes);pending[payload.id]=Pair(id,promise)
    // Resolve on transport completion, not just enqueue. No claim of application-level delivery ACK.
    client.sendPayload(id,payload).addOnFailureListener{finish(payload.id,it.message?:"Send failed")}
    handler.postDelayed({finish(payload.id,"Transfer timed out (10 seconds)")},10000)
   }
  }
  AsyncFunction("stop"){
   client.stopAdvertising();client.stopDiscovery();client.stopAllEndpoints();connected.clear();names.clear()
   pending.keys.toList().forEach{finish(it,"Transport stopped")}
  }
  AsyncFunction("claim"){raw:String -> db.claim(raw)}
  AsyncFunction("log"){raw:String -> db.log(raw)}
  AsyncFunction("snapshot"){db.snapshot()}
  AsyncFunction("clear"){db.clear()}
  AsyncFunction("exportLog"){nodeId:String,label:String ->
   val data=JSONObject(db.snapshot()).put("nodeId",nodeId).put("label",label.take(80))
   val run=JSONObject().put("schemaVersion",1).put("runId",UUID.randomUUID().toString()).put("source","android").put("createdAt",System.currentTimeMillis()).put("nodes",JSONArray().put(data))
   val folder=File(context.cacheDir,"mesh_exports");folder.mkdirs()
   val file=File(folder,"meshaid-${nodeId.take(8)}.json");file.writeText(run.toString(2))
   val uri=FileProvider.getUriForFile(context,"${context.packageName}.mesh.files",file)
   val intent=Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
   context.startActivity(Intent.createChooser(intent,"Export review logs").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  OnDestroy {
   client.stopAdvertising();client.stopDiscovery();client.stopAllEndpoints()
   pending.keys.toList().forEach{finish(it,"Native module destroyed")}
   handler.removeCallbacksAndMessages(null)
  }
 }
}
