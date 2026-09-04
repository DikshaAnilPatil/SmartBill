
  # Business Management Dashboard

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Subscription limits

  Subscription limits and feature permissions are enforced by the backend
  middleware in `Backend/middleware/checkPlanLimits.js`. The current data model
  represents one business per owner account; it does not support multiple
  businesses under one account. A future multi-business feature will require a
  business entity and ownership relationship before a business-count limit can
  be enforced meaningfully.
  
