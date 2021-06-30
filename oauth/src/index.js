const _ = require('lodash');
const path = require('path');
const express = require('express');
const hubspot = require('@hubspot/api-client');
const bodyParser = require('body-parser');
require('./config');

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync');
const { Console } = require('console');
const adapter = new FileSync('db.json')
const db = low(adapter)

const PORT = 3000;
const OBJECTS_LIMIT = 30;
const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const SCOPES = 'contacts timeline oauth crm.objects.custom.read transactional-email';
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;
const GRANT_TYPES = {
  AUTHORIZATION_CODE: 'authorization_code',
  REFRESH_TOKEN: 'refresh_token',
};

const logResponse = (message, data) => {
  console.log(message, JSON.stringify(data, null, 1));
};

const checkEnv = (req, res, next) => {
  if (_.startsWith(req.url, '/error')) return next();

  if (_.isNil(CLIENT_ID))
    return res.redirect(
      '/error?msg=Please set HUBSPOT_CLIENT_ID env variable to proceed'
    );
  if (_.isNil(CLIENT_SECRET))
    return res.redirect(
      '/error?msg=Please set HUBSPOT_CLIENT_SECRET env variable to proceed'
    );

  next();
};

const isAuthorized = () => {
  console.log('IS EVER AUTHORIZED??', !_.isEmpty(db.get('refreshToken').value()));
  return !_.isEmpty(db.get('refreshToken').value());
};

const isTokenExpired = () => {
  console.log('is token expired?', Date.now(), db.get('updatedAt').value() + db.get('expiresIn').value() * 1000, Date.now() >= db.get('updatedAt').value() + db.get('expiresIn').value() * 1000)
  return Date.now() >= db.get('updatedAt').value() + db.get('expiresIn').value() * 1000;
};

const prepareContactsContent = (contacts) => {
  return _.map(contacts, (contact) => {
    const companyName = _.get(contact, 'properties.company') || '';
    const name = getFullName(contact.properties);
    return { id: contact.id, name, companyName };
  });
};

const getFullName = (contactProperties) => {
  const firstName = _.get(contactProperties, 'firstname') || '';
  const lastName = _.get(contactProperties, 'lastname') || '';
  return `${firstName} ${lastName}`;
};

const refreshToken = async () => {
  const result = await hubspotClient.oauth.defaultApi.createToken(
    GRANT_TYPES.REFRESH_TOKEN,
    undefined,
    undefined,
    CLIENT_ID,
    CLIENT_SECRET,
    db.get('refreshToken').value()
  );
  db.set('refreshToken', result.body.refreshToken).write();
  db.set('expiresIn', result.body.expiresIn).write();
  db.set('accessToken', result.body.accessToken).write();
  db.set('updatedAt', Date.now()).write();
  console.log('Updated tokens');

  hubspotClient.setAccessToken(db.get('accessToken').value());
};

const handleError = (e, res) => {
  if (_.isEqual(e.message, 'HTTP request failed')) {
    const errorMessage = JSON.stringify(e, null, 2);
    console.error(errorMessage);
    return res.redirect(`/error?msg=${errorMessage}`);
  }

  console.error(e);
  res.redirect(
    `/error?msg=${JSON.stringify(e, Object.getOwnPropertyNames(e), 2)}`
  );
};

const app = express();

const hubspotClient = new hubspot.Client();

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
  })
);

app.use(
  bodyParser.json({
    limit: '50mb',
    extended: true,
  })
);

app.use(checkEnv);

app.get('/', async (req, res) => {
  try {
    if (!isAuthorized()) return res.render('login');
    if (isTokenExpired()) await refreshToken();
    hubspotClient.setAccessToken(db.get('accessToken').value());


    const properties = ['firstname', 'lastname', 'company'];

    // Get first contacts page
    // GET /crm/v3/objects/contacts
    // https://developers.hubspot.com/docs/api/crm/contacts

    // sending a transactional email
    const emailResponse = await hubspotClient.apiRequest({
      method: "POST",
      path: "/email/public/v1/singleEmail/send",
      body: {
        "emailId": 43746163346,
        "message": {
          "to": "jesper@naesandfriends.com",
          "sendId": "foobar3"
        },
        "contactProperties": [
          {
            "name": "firstname",
            "value": "John"
          },
          {
            "name": "lastname",
            "value": "Johnsson"
          }
        ],
        "customProperties": [
          {
            "name": "item_1",
            "value": "something they bought"
          },
          {
            "name": "depot",
            "value": "so much money"
          }
        ]
      },
    })

    console.log('emailResponse', emailResponse);

    const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
      OBJECTS_LIMIT,
      undefined,
      properties
    );
    //console.log('got responses', contactsResponse);
    //logResponse('Response from API', contactsResponse);

    res.render('contacts', {
      tokenStore: {
        refreshToken: db.get('refreshToken').value(),
        accessToken: db.get('accessToken').value(),
        expiresIn: db.get('expiresIn').value(),
        updatedAt: db.get('updatedAt').value()
      },
      contacts: prepareContactsContent(contactsResponse.body.results),
    });
  } catch (e) {
    handleError(e, res);
  }
});

app.use('/oauth', async (req, res) => {
  // Use the client to get authorization Url
  // https://www.npmjs.com/package/@hubspot/api-client#obtain-your-authorization-url
  console.log('Creating authorization Url');
  const authorizationUrl = hubspotClient.oauth.getAuthorizationUrl(
    CLIENT_ID,
    REDIRECT_URI,
    SCOPES
  );
  console.log('Authorization Url', authorizationUrl);

  res.redirect(authorizationUrl);
});

app.use('/oauth-callback', async (req, res) => {
  const code = _.get(req, 'query.code');

  // Create OAuth 2.0 Access Token and Refresh Tokens
  // POST /oauth/v1/token
  // https://developers.hubspot.com/docs/api/working-with-oauth
  console.log('Retrieving access token by code:', code);
  const getTokensResponse = await hubspotClient.oauth.defaultApi.createToken(
    GRANT_TYPES.AUTHORIZATION_CODE,
    code,
    REDIRECT_URI,
    CLIENT_ID,
    CLIENT_SECRET
  );
  logResponse('Retrieving access token result:', getTokensResponse);

  db.set('refreshToken', getTokensResponse.body.refreshToken).write();
  db.set('expiresIn', getTokensResponse.body.expiresIn).write();
  db.set('accessToken', getTokensResponse.body.accessToken).write();
  db.set('updatedAt', Date.now()).write();

  // Set token for the
  // https://www.npmjs.com/package/@hubspot/api-client
  hubspotClient.setAccessToken(db.get('accessToken').value());
  res.redirect('/');
});

app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('/refresh', async (req, res) => {
  try {
    if (isAuthorized()) await refreshToken();
    res.redirect('/');
  } catch (e) {
    handleError(e, res);
  }
});

app.get('/error', (req, res) => {
  res.render('error', { error: req.query.msg });
});

app.use((error, req, res) => {
  res.render('error', { error: error.message });
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
