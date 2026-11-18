package com.paradigm.ifs;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * OfflineLocationStore — SQLite durable buffer for native GPS tracking pings.
 *
 * Resolves Audit Finding 17: Prevents background location loss during network drops
 * by persisting unuploaded tracking pings to local SQLite database and replaying them
 * in strict chronological order upon network reconnection.
 */
public class OfflineLocationStore extends SQLiteOpenHelper {

    private static final String TAG = "OfflineLocationStore";
    private static final String DB_NAME = "paradigm_offline_tracking.db";
    private static final int DB_VERSION = 1;

    private static final String TABLE_LOCATIONS = "offline_locations";
    private static final String COL_ID = "id";
    private static final String COL_REQUEST_ID = "request_id";
    private static final String COL_PAYLOAD = "payload";
    private static final String COL_CREATED_AT = "created_at";

    private static OfflineLocationStore instance;

    public static synchronized OfflineLocationStore getInstance(Context context) {
        if (instance == null) {
            instance = new OfflineLocationStore(context.getApplicationContext());
        }
        return instance;
    }

    private OfflineLocationStore(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String createTable = "CREATE TABLE " + TABLE_LOCATIONS + " ("
                + COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, "
                + COL_REQUEST_ID + " TEXT UNIQUE, "
                + COL_PAYLOAD + " TEXT NOT NULL, "
                + COL_CREATED_AT + " INTEGER NOT NULL"
                + ");";
        db.execSQL(createTable);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Migration logic for future schema increments
    }

    /**
     * Enqueues an unuploaded location ping into the local SQLite store.
     */
    public synchronized boolean enqueueLocation(JSONObject body) {
        if (body == null) return false;

        try {
            SQLiteDatabase db = getWritableDatabase();
            ContentValues cv = new ContentValues();
            String reqId = body.optString("requestId", java.util.UUID.randomUUID().toString());
            cv.put(COL_REQUEST_ID, reqId);
            cv.put(COL_PAYLOAD, body.toString());
            cv.put(COL_CREATED_AT, System.currentTimeMillis());

            long rowId = db.insertWithOnConflict(TABLE_LOCATIONS, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            if (rowId != -1) {
                Log.d(TAG, "[OfflineBuffer] Buffered location ping id=" + reqId + " (row=" + rowId + ")");
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "[OfflineBuffer] Failed to buffer location ping", e);
        }
        return false;
    }

    public static class QueuedLocation {
        public final long id;
        public final String requestId;
        public final JSONObject payload;

        public QueuedLocation(long id, String requestId, JSONObject payload) {
            this.id = id;
            this.requestId = requestId;
            this.payload = payload;
        }
    }

    /**
     * Retrieves a batch of pending location pings ordered chronologically.
     */
    public synchronized List<QueuedLocation> getPendingBatch(int limit) {
        List<QueuedLocation> list = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor cursor = null;

        try {
            cursor = db.query(
                    TABLE_LOCATIONS,
                    new String[]{COL_ID, COL_REQUEST_ID, COL_PAYLOAD},
                    null, null, null, null,
                    COL_CREATED_AT + " ASC",
                    String.valueOf(limit)
            );

            if (cursor != null && cursor.moveToFirst()) {
                do {
                    long id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID));
                    String reqId = cursor.getString(cursor.getColumnIndexOrThrow(COL_REQUEST_ID));
                    String rawJson = cursor.getString(cursor.getColumnIndexOrThrow(COL_PAYLOAD));
                    list.add(new QueuedLocation(id, reqId, new JSONObject(rawJson)));
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.e(TAG, "[OfflineBuffer] Failed to read pending locations", e);
        } finally {
            if (cursor != null) cursor.close();
        }

        return list;
    }

    /**
     * Removes successfully synced records from the offline database by ID.
     */
    public synchronized int deleteRecords(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return 0;

        int deletedCount = 0;
        try {
            SQLiteDatabase db = getWritableDatabase();
            StringBuilder whereClause = new StringBuilder(COL_ID + " IN (");
            for (int i = 0; i < ids.size(); i++) {
                whereClause.append(ids.get(i));
                if (i < ids.size() - 1) whereClause.append(",");
            }
            whereClause.append(")");

            deletedCount = db.delete(TABLE_LOCATIONS, whereClause.toString(), null);
            Log.d(TAG, "[OfflineBuffer] Cleared " + deletedCount + " synced locations from local buffer");
        } catch (Exception e) {
            Log.e(TAG, "[OfflineBuffer] Failed to delete synced locations", e);
        }
        return deletedCount;
    }

    /**
     * Returns total count of pending offline location points.
     */
    public synchronized int getPendingCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor cursor = null;
        try {
            cursor = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_LOCATIONS, null);
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getInt(0);
            }
        } catch (Exception e) {
            Log.e(TAG, "[OfflineBuffer] Failed to get pending count", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        return 0;
    }
}
