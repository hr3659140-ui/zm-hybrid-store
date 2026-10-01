# ZM Hybrid Store — AliExpress Importer

## What it does
Open an AliExpress product page, click the extension, and ZM Admin opens with the product title, description, supplier URL, detected price, and images prefilled.

The importer creates a **draft** product so you can review price, target market, commission, category and content before publishing.

## Install in Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `tools/zm-aliexpress-importer/`.
5. Pin **ZM Hybrid Store — AliExpress Importer**.

## Use
1. Log in to ZM Hybrid Store Admin.
2. Open AliExpress product page.
3. Click the extension → **Import to ZM Store**.
4. Review the importer form.
5. Click **Create product draft**.
6. Open Products, review images/details/pricing and publish when ready.

## Notes
- This bridge does not store AliExpress credentials or customer data.
- AliExpress page markup can change, so some products may require manual correction.
- For full automated supplier ordering/tracking, DSers remains a separate fulfillment platform. DSers officially supports one-click product import via its Chrome extension; custom storefronts can require a custom DSers integration or CSV workflow.
