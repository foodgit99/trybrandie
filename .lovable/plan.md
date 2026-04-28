I found the website onboarding failure is coming from the `brand-scraper` backend function, not the onboarding UI itself.

Recent logs show two failure paths:

1. The scraper sometimes receives a non-JSON `Bad Gateway` response from the website scraping service, then crashes while calling `.json()`.
2. The AI analysis step has recently failed on an invalid/old AI endpoint in the deployed function, causing the backend function to return a generic non-2xx error to the app.

Plan to fix it:

1. Harden the website scraping response handling
   - Update `supabase/functions/brand-scraper/index.ts` so it reads the scraping response as text first.
   - Safely parse JSON only when possible.
   - If the scraping service returns plain text like `Bad Gateway`, return a clean user-facing message instead of crashing.
   - Preserve the existing CORS and authentication behavior.

2. Harden the AI analysis call
   - Keep the AI gateway endpoint consistent with the working functions in the project.
   - Wrap the AI fetch in the existing timeout utility.
   - Read AI responses safely instead of assuming every response body is valid JSON.
   - Add clearer status handling for rate limits, service errors, and malformed AI responses.

3. Add a fallback brand extraction path
   - If the AI analysis step fails after scraping succeeded, generate a basic brand object from available website metadata/branding instead of failing the entire onboarding step.
   - Use defaults for missing fields so the onboarding form can still be pre-filled and the user can continue.
   - This keeps “Scan my website” useful even when the AI service is temporarily flaky.

4. Improve the onboarding error shown to users
   - Update `src/pages/Onboarding.tsx` so backend function errors display the actual returned message where possible, instead of only `Edge Function returned a non-2xx status code`.
   - Apply the same pattern to the Brand Centre website import flow in `src/pages/BrandCentre.tsx` for consistency.

5. Verify the fix
   - Test the `brand-scraper` function path with `https://merch-jungle.com/`.
   - Confirm failure cases return clean messages and successful/partial cases pre-fill onboarding without blocking the user.