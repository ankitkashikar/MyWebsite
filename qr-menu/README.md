# The Chinese Bliss — QR Counter Menu

Standalone, text-only customer menu intended for a dedicated Vercel project.

## Security boundary

Deploy this folder as its own Vercel project with **Root Directory = \`qr-menu\`**.

The deployment then contains only this folder. Changing the customer URL to paths such as \`/admin\`, \`/orders\`, or \`/inventory\` will not expose files from the main website repository. Unknown paths return a 404.

This is isolation, not secrecy. The GitHub repository is public, so no private secrets belong in this folder.

## Data

The page reads active rows from \`public.qr_menu_items\` using the public Supabase anon key. RLS allows public SELECT of active rows only. Browser users have no INSERT/UPDATE/DELETE policy.

## Vercel

1. Add a new Vercel project from the existing GitHub repository.
2. Set Root Directory to \`qr-menu\`.
3. Framework Preset: Other.
4. No build command is required.
5. Deploy.
6. Add the final custom domain, for example \`menu.thechinesebliss.in\`.
7. Generate one QR code for that permanent domain.

Do not point the printed QR at a preview deployment URL.

## Price changes

Price/name/category changes are database updates only. The QR code and frontend deployment stay unchanged.

A dedicated admin editor can be added to the protected staff system later. Until then, rows can be managed in the Supabase Table Editor after the migration is reviewed and applied.