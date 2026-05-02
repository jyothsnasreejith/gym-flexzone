# Debugging File Upload Issues - Complete Guide

## Deploy Status
✅ Code deployed to Vercel (commit: 5f0ff2c)
✅ Comprehensive logging added to all upload stages
⏳ **NEXT**: Test on public join and check console logs

## How to Test and Debug

### Step 1: Open Public Join Link
1. Go to: https://app.flexzonefitness.in/JOIN (or localhost:5173/JOIN for testing)
2. Open DevTools: **F12** or Right-click → Inspect
3. Go to **Console** tab
4. Fill form and try to register

### Step 2: Monitor Console During Upload
The console will show sections separated by equals signs (=======). Watch for these messages:

#### **COMPRESSION PHASE**
```
🔄 Creating object URL for compression...
🖼️ Image loaded for compression: {originalDimensions}
📐 Compression scaling: {scale, targetDimensions}
✅ Image compressed: {original, compressed, saved percentage}
```

**If compression fails**: Look for `❌ Compression error:` or `❌ Could not load image`
- This indicates: Canvas API issue, CORS problem, or invalid image

#### **STORAGE UPLOAD PHASE**
```
============================================================
🚀 PROFILE PHOTO UPLOAD SEQUENCE STARTING
============================================================

📸 Initial Profile Photo File: {name, size, type, instanceof checks}
📤 STORAGE UPLOAD - ATTEMPT 1/3: {fileName, fileSize, bucketName}

🔄 Upload attempt 1/3...
📡 Storage API Response: {hasError, hasData, error details}
✅ Storage upload successful!

🔗 Getting public URL...
✅ PROFILE PHOTO PUBLIC URL: {publicUrl, urlLength}
```

**If storage upload fails**: Look for `❌ PROFILE PHOTO STORAGE UPLOAD FAILED:`
- Error codes to look for:
  - `401` → Authentication failed (anon key issue)
  - `403` → Permission denied (bucket permissions)
  - `413` → Payload too large (file size limit)
  - `CORS` → Cross-origin issue (proxy/CORS policy)

#### **RPC UPDATE PHASE**
```
🔄 Calling update_member_images RPC function...

📡 RPC Response: {
  hasError: boolean,
  hasData: boolean,
  error: {message, code, status},
  data: result
}
```

**If RPC fails**: Look for `❌ ID PROOF URL UPDATE RPC FAILED:` or `❌ PROFILE PHOTO URL UPDATE RPC FAILED:`
- Error codes:
  - `42P01` → Function not found (migration not applied)
  - `42501` → Permission denied (GRANT not executed)
  - `22P02` → Invalid parameter (UUID format issue)

### Step 3: Identify the Failure Point

#### Scenario A: Compression fails
```
❌ Compression error: [error details]
OR
❌ Could not load image for compression: [error]
```
**Action**: 
- Check if image format is supported (JPG, PNG, WebP, GIF)
- Try a different image
- Check browser console for CORS errors

#### Scenario B: Storage upload fails (most common)
```
📡 Storage API Response: {
  hasError: true,
  error: {
    message: "...",
    code: "403",
    status: 403
  }
}
```
**Meaning**: Supabase storage bucket doesn't allow anon role uploads

**Action**:
1. Check Supabase Storage bucket permissions
2. Go to: Supabase Dashboard → Storage → member-avatars (or id-proofs)
3. Click the bucket name
4. Check "Policies" tab
5. Ensure there's a policy allowing INSERT for authenticated or public role

**If policy is missing**, run this SQL in Supabase SQL Editor:
```sql
-- Allow anon uploads to storage buckets
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'member-avatars' OR bucket_id = 'id-proofs');

CREATE POLICY "Allow public to read uploads" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'member-avatars' OR bucket_id = 'id-proofs');
```

#### Scenario C: RPC update fails
```
❌ ID PROOF URL UPDATE RPC FAILED: {
  message: "function public.update_member_images(uuid, text, text) does not exist",
  code: "42P01"
}
```

**Meaning**: RPC function not created in Supabase

**Action**:
1. Apply the SQL migration from: `supabase/migrations/20260502_update_member_images_function.sql`
2. Go to Supabase → SQL Editor → New Query
3. Copy the entire SQL migration file
4. Execute it
5. Should see confirmation: "CREATE FUNCTION"

#### Scenario D: RPC permission denied
```
❌ ID PROOF URL UPDATE RPC FAILED: {
  message: "permission denied for function update_member_images",
  code: "42501"
}
```

**Meaning**: GRANT permissions not set on RPC function

**Action**:
Run this SQL in Supabase SQL Editor:
```sql
GRANT EXECUTE ON FUNCTION public.update_member_images(UUID, TEXT, TEXT) 
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_member_images(UUID, TEXT, TEXT) 
  TO public;
```

#### Scenario E: Member record not found
```
❌ RPC Response shows:
{
  hasError: false,
  hasData: null
}
```

**Meaning**: Member ID doesn't exist or wasn't inserted properly

**Action**:
1. Check if member was actually created:
   - Go to Supabase Dashboard
   - Click on "members" table
   - Look for newest member records
   - Verify the ID matches the one being used for upload

2. If member exists but RPC returns null:
   - Check member table structure: `profile_image_url` and `id_proof_url` columns exist
   - They should allow NULL values
   - Type should be `text`

## Database Checks (in Supabase)

### Check 1: RPC Function Exists
```sql
SELECT routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_member_images';
```
Should return 1 row with `routine_type` = "FUNCTION"

### Check 2: Function Permissions
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'update_member_images';
```
Should show `anon` with `EXECUTE` permission

### Check 3: Members Table Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'members'
  AND (column_name = 'profile_image_url' OR column_name = 'id_proof_url');
```
Both should be `text` type and `YES` for nullable

### Check 4: Storage Bucket Exists
```sql
SELECT name, public, owner
FROM storage.buckets
WHERE name IN ('member-avatars', 'id-proofs');
```
Should return 2 rows, both with `public` = true

### Check 5: Latest Member Records
```sql
SELECT id, full_name, profile_image_url, id_proof_url, created_at
FROM members
ORDER BY created_at DESC
LIMIT 10;
```
Check if newly registered members show NULL for image URLs

## Mobile-Specific Debugging

### For iPhone/iPad
1. Open public join in Safari
2. Open Developer Tools (Settings → Safari → Advanced → Web Inspector)
3. Check console during upload
4. Look for CORS or file API errors

### For Android
1. Open public join in Chrome
2. Go to chrome://inspect
3. Connect phone via USB
4. Inspect the page
5. Go to Console tab
6. Watch upload logs

## Common Issues Summary

| Issue | Symptom | Solution |
|-------|---------|----------|
| Storage permissions | `403` error on upload | Add storage bucket policies |
| RPC not created | `42P01` error | Apply SQL migration |
| RPC permissions | `42501` error | Run GRANT statements |
| Compression fails | `❌ Compression error` | Try different image format |
| File not passed | `⚠️ FILE NOT PROVIDED` | Check MemberForm.jsx file selection |
| Blob URL revoked | Upload silently fails | Use RPC approach (already implemented) |
| Mobile CORS | Upload blocked | Check Supabase CORS settings |

## Next Steps

1. **Test the upload** on public join page
2. **Check console logs** - identify which phase fails
3. **Match to scenarios above** - follow the corresponding fix
4. **Apply fixes** to Supabase
5. **Retest** - should see success messages

## Support Commands

If you need to manually check everything:

```bash
# Check if running locally
npm run dev

# Test uploads on: http://localhost:5173/JOIN

# Check Supabase CLI status
supabase status

# Show remote database URL
echo $VITE_SUPABASE_URL

# Clear browser cache before retesting
# Chrome: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
```

---

**Key Takeaway**: The console logs will clearly show:
- ✅ SUCCESS: All green checkmarks through to "PROFILE PHOTO URL SAVED TO DATABASE"
- ❌ FAILURE: Red X marks where exactly the process stopped

Use the logs to match your symptoms to the scenarios above!

