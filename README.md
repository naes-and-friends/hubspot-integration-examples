# Naes & Friends Hubspot integration examples
To sync data into your hubspot setup you need to first map the necessary data to hubspot objects, and then set up two integrations to synk that data:
1. A historical import, going as far back as you need to.
2. A running current sync, adding new data into hubspot keeping everything up to date.

The examples in this repository will show you how this can be done.

## /api-key
Test app for api key integrations. API Key apps are used to set up new object schemas and relationships. As well as doing batch importing. Think of this as the development solution for rapid setup.

To use the example apps, copy the `.env.template` file and rename the copy `.env`. Then add your API key.

Instructions for how to get api keys are [available here](https://legacydocs.hubspot.com/docs/faq/developer-api-keys).

Instructions for hubspot API endpoint can be [found here](https://developers.hubspot.com/docs/api/crm/contacts).

## /oauth
Is the test app for Oauth integrations. Used for timeline events, transactinal email sends, etc. Think of this as the permanent or production solution.

This example is based on the oauth hubspot example and has been modified to store secure session info on a local db to support development.

**Please rewrite this for your needs, do not use this in production.**