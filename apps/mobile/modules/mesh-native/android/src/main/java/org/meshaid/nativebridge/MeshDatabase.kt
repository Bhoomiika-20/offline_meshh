package org.meshaid.nativebridge

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** SQLite is the Review 1 persistence adapter. Room/LRU are deferred. */
class MeshDatabase(context: Context) : SQLiteOpenHelper(context, "meshaid-review1.db", null, 1) {
 override fun onCreate(db: SQLiteDatabase) {
  db.execSQL("CREATE TABLE alerts (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, saved_at INTEGER NOT NULL)")
  db.execSQL("CREATE TABLE events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL)")
 }
 override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { error("Database migration required") }
 @Synchronized fun claim(raw: String): Boolean {
  val obj=JSONObject(raw); val db=writableDatabase
  db.rawQuery("SELECT id FROM alerts WHERE id = ?", arrayOf(obj.getString("alertId"))).use { if(it.moveToFirst())return false }
  db.rawQuery("SELECT COUNT(*) FROM alerts",null).use { it.moveToFirst();check(it.getInt(0)<1000){"Review storage full: export and clear history"} }
  val values=ContentValues().apply {put("id",obj.getString("alertId"));put("payload",raw);put("saved_at",System.currentTimeMillis())}
  // A durable primary-key insert atomically implements both alert storage and the seen-UUID registry.
  return db.insertWithOnConflict("alerts",null,values,SQLiteDatabase.CONFLICT_IGNORE)!=-1L
 }
 @Synchronized fun log(raw: String) {
  val obj=JSONObject(raw); val db=writableDatabase
  db.beginTransaction()
  try {
   db.insertOrThrow("events",null,ContentValues().apply {put("id",obj.getString("eventId"));put("payload",raw)})
   db.execSQL("DELETE FROM events WHERE seq NOT IN (SELECT seq FROM events ORDER BY seq DESC LIMIT 5000)")
   db.setTransactionSuccessful()
  }finally{db.endTransaction()}
 }
 @Synchronized fun snapshot(): String {
  val alerts=JSONArray();val events=JSONArray()
  readableDatabase.rawQuery("SELECT payload FROM alerts ORDER BY saved_at",null).use {while(it.moveToNext())alerts.put(JSONObject(it.getString(0)))}
  readableDatabase.rawQuery("SELECT payload FROM events ORDER BY seq",null).use {while(it.moveToNext())events.put(JSONObject(it.getString(0)))}
  return JSONObject().put("alerts",alerts).put("logs",events).toString()
 }
 @Synchronized fun clear() {writableDatabase.beginTransaction();try{writableDatabase.delete("events",null,null);writableDatabase.delete("alerts",null,null);writableDatabase.setTransactionSuccessful()}finally{writableDatabase.endTransaction()}}
}
