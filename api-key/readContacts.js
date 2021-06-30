const dotenv = require("dotenv");
const hubspot = require('@hubspot/api-client');
const { CollectionResponsePublicOwner } = require("@hubspot/api-client/lib/codegen/crm/owners/api");

dotenv.config();
const apikey = process.env.API_KEY;
const hubspotClient = new hubspot.Client({ apiKey: `${apikey}` })

hubspotClient.apiRequest({
    method: 'POST',
    path: `/crm/v3/objects/Contact/batch/read`,
    body: {
        properties: [
            "email"
        ],
        idProperty: "email",
        inputs: [
            {
                "id": "annelie@naesandfriends.com",
                "id": "jesper@naesandfriends.com",
                "id": "kaisa@naesandfriends.com"
            }
        ]

    }
}).then(res => console.log(res.response.body)).catch(err => console.warn(err))
