---
description: Deploy backend SEO Phase 2 (Auto-linking)
---

This workflow helps you deploy the Phase 2 changes for the backend SEO system.

1. **Run Database Migration**
   Execute the migration script to create the `seo_keywords` table and add `schema_data` column.
   
   ```bash
   mysql -h 127.0.0.1 -u erg -p erg_db < migrations/manual-seo-keywords.sql
   ```
   *(Enter password `erg_password` if prompted)*

2. **Verify Server Restart**
   If running `yarn start:dev`, check terminal for successful restart.
   Otherwise, restart the server:
   
   ```bash
   yarn start:dev
   ```

3. **Check Swagger Documentation**
   Open http://localhost:3003/api-docs and look for new endpoints under the **SEO** tag:
   - `GET /seo/keywords`
   - `POST /seo/keywords`
   - `DELETE /seo/keywords/{id}`
   - `PUT /seo/apply-autolinks/{postId}`
   - `PUT /seo/apply-autolinks/bulk`

4. **Test Functionality**
   - Create a keyword using `POST /seo/keywords`.
   - Apply auto-links to a post using `PUT /seo/apply-autolinks/{postId}`.
   - Verify that the post content now contains `<a>` tags for the keyword.
