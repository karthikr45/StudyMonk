# School catalog

Admins can add schools under **Admin → Schools** (`/admin/schools`). The school directory is stored in PostgreSQL; names are unique after trimming, collapsing whitespace and case normalization. Students cannot create school entries.

Student signup fetches `GET /api/catalog/schools` and renders active database records in a required dropdown. Registration now accepts `schoolId` rather than a free-text `schoolName`. The server validates the selected record and copies its canonical name into the existing group-matching profile fields. Invalid or inactive school IDs are rejected. Existing students retain their profiles.

## Database rollout

Run `npm run db:migrate` against the intended database before starting this version. Migration `0010_school_catalog` creates School and the optional User.schoolId relation, inserts **TNR Excelencia** as the sole initial catalog entry, and links existing users whose normalized school name matches. Other existing school names are preserved but are not added to the new signup directory. No application component or API response contains a hardcoded school option.

Deploy client and API together. Native clients must send schoolId from the catalog endpoint. Admin edits/deactivation are not included in this add-school feature.

Validation: production build passed and all 16 tests passed against an isolated database. Coverage includes seeded catalog reads, admin-only creation, duplicate normalization, dynamically added school visibility, inactive/unknown school rejection and canonical names on newly registered users. The migration has not been run against the user's live database: this checkout has no configured live DATABASE_URL.

## Academic-year dropdown

Signup also fetches `/api/catalog/academic-years`. The server supplies the current academic year plus four previous years, newest first, and registration validates against the same policy. Future/nonconsecutive/out-of-range values are rejected. The default rollover policy is April 1 in Asia/Kolkata; adjust `src/lib/academicYears.ts` if the school uses a different start month. No database migration is required for this dropdown.
