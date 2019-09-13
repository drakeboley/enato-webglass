const puppeteer = require('puppeteer')
const WebSocket = require('ws');
const AWS = require('aws-sdk').default;
const Amplify = require('aws-amplify').default
const { Auth } = Amplify
//const pngdiff =  require('png-diff');
const { Writable } = require('stream');
//const stream = require('stream-wrapper')
const gql = require('graphql-tag')
const zlib = require('zlib');
const appsync = require('aws-appsync').default
const wss = new WebSocket.Server({ port: 8081 });

global.WebSocket = require('ws');
global.window = global.window || {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    WebSocket: global.WebSocket,
    ArrayBuffer: global.ArrayBuffer,
    addEventListener: function () { },
    navigator: { onLine: true }
};
global.localStorage = {
    store: {},
    getItem: function (key) {
        return this.store[key]
    },
    setItem: function (key, value) {
        this.store[key] = value
    },
    removeItem: function (key) {
        delete this.store[key]
    }
};
require('es6-promise').polyfill();
require('isomorphic-fetch');
const AWSAppSyncClient = require('aws-appsync').default

const awsmobile = {
    "aws_project_region": "us-east-1",
    "aws_cognito_identity_pool_id": "us-east-1:55adc0a7-86ba-4b2b-b2c3-8b60da26a1cd",
    "aws_cognito_region": "us-east-1",
    "aws_user_pools_id": "us-east-1_LoomTCqju",
    "aws_user_pools_web_client_id": "326h9qrmt5vvb8brdqiis02eb0",
    "oauth": {
        "domain": "ums973cd6e5-973cd6e5-dev.auth.us-east-1.amazoncognito.com",
        "scope": [
            "phone",
            "email",
            "openid",
            "profile",
            "aws.cognito.signin.user.admin"
        ],
        "redirectSignIn": "https://enato.io/admin/",
        "redirectSignOut": "https://enato.io/",
        "responseType": "code"
    },
    "federationTarget": "COGNITO_USER_POOLS",
    "aws_content_delivery_bucket": "ums-20190809002828-hostingbucket-dev",
    "aws_content_delivery_bucket_region": "us-east-1",
    "aws_content_delivery_url": "http://ums-20190809002828-hostingbucket-dev.s3-website-us-east-1.amazonaws.com",
    "aws_appsync_graphqlEndpoint": "https://oqgxpucf7jgqrdpesqljykpxw4.appsync-api.us-east-1.amazonaws.com/graphql",
    "aws_appsync_region": "us-east-1",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS"
  };
  const path = require('path');
  Amplify.configure(awsmobile)
  const GRAPHQL_API_REGION = awsmobile.aws_appsync_region
  const GRAPHQL_API_ENDPOINT_URL = awsmobile.aws_appsync_graphqlEndpoint
  const AUTH_TYPE = awsmobile.aws_appsync_authenticationType
   Auth.signIn('drake@enato.io', 'LiveLaughLove').then(() => {
  // AppSync client instantiation
  const client = new appsync({
    url: GRAPHQL_API_ENDPOINT_URL,
    region: GRAPHQL_API_REGION,
    auth: {
      type: AUTH_TYPE,
      // Get the currently logged in users credential.
      jwtToken: async () => (await Auth.currentSession()).getAccessToken().getJwtToken(),
    },
    // Amplify uses Amazon IAM to authorize calls to Amazon S3. This provides the relevant IAM credentials.
    complexObjectsCredentials: () => Auth.currentCredentials(),
    fetch: fetch
  });
const browsers = []
function noop() {}

function heartbeat() {
    this.isAlive = true;
  }
  let cachedImage = []
  wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(ms) {
    let message = JSON.parse(ms);
    let { uuid, height, width } = message;
    const sysId = uuid.split('|')[0]
    const browserId = uuid.split('|')[1]  
    debugger
      if (message.type === "openUrl") {
        const query = gql`
        {
            getInstance (id: "${sysId}") {
                id
                details
                }
        }`
        client.query({ query: query })
        .then((data) => {
            if (data && data.data && data.data.getInstance) {
                debugger
                openPage(ws, data.data.getInstance.details, height, width)
            }
        })
        .catch((err) => {
            console.log(err)
            connection.terminate()
            clearInterval(interval)
        });
      }
      else if (message.type === 'close') {
          browsers[browserId].browser.close()
          ws.send('closed');
          ws.terminate(); 
      }
      else if (message.type === 'click' && browsers[browserId]) {
          sendClick(ws, browserId, message)
      }
      else if (message.type === 'keyboard' && browsers[browserId]) {
          sendKeyboard(ws, browserId, message)
      }
      else if (message.type === 'image' && browsers[browserId]) {
          sendNewImage(ws, browserId, message.height, message.width)
      }
      else if (message.type === 'back' && browsers[browserId]) {
          sendBack(ws, browserId, message)
      }
      else if (message.type === 'forward' && browsers[browserId]) {
          sendForward(ws, browserId, message)
      }
  
    });
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.send('connected');
  });
  
  async function openPage(connection, url, uuid, height, width) {
          console.log('openPage fired')
          const browser = await puppeteer.launch({
            args: ['--disable-dev-shm-usage']
          }).catch((err) => {
            console.log(err)
          });
          const context = await browser.createIncognitoBrowserContext();
          const page = await context.newPage();
          await page.goto(url);
          page.on('request', () => {
              connection.send('request')
          })

          page.on('requestfinished', () => {
              connection.send('requestfinished')
              browsers[uuid].itsOk = true;
              //sendNewImage(connection, uuid)
          })
          page.on('pageerror', pageerr => {
              console.log('pageerror occurred: ', pageerr);
              connection.send('page error: ' + pageerr)
          })
           browsers[uuid] = {
              browser: browser,
              page: page,
              keyboard: page.keyboard,
              mouse: page.mouse,
              itsOk: true
          };
          sendNewImage(connection, uuid, height, width)
  }
  
  async function sendNewImage (connection, uuid, height, width) {
      debugger
      const browser = browsers[uuid].browser;
      const page = browsers[uuid].page;
      //browsers[uuid].image2 = null;
      const outStream = new Writable({
          write(chunk, encoding, callback) {
              console.log('data')
              if (connection.isAlive) {
                  connection.send(chunk)
              }
          }
      });
      height = height || 600
      width = width || 800
      const viewPort= {width:Number(height), height:Number(width)};
      await page.setViewport(viewPort);
      page.screenshot({fullPage: true, encoding: 'base64'}).then( (data) => {
              
              if (data === cachedImage) {
                  return connection.send('same')
              }
              else {
                  cachedImage = data
              }
          
              /*var rs = stream.readable(function(size) {
                  this.push(data);                
              });
              rs.pipe(gz).pipe(outStream);
              */
              zlib.gzip(data, (err, response) => {
                  connection.send(response)
              });
          if (connection.isAlive) {
              image2 = null      
              //sendNewImage(connection, uuid)
          } else
          { 
              browsers[uuid] = null
              connection.terminate()
          }
      });
  
      
      //let image1 = fs.createReadStream('./png/' + uuid + '_1.png');
      //let image2 = fs.createReadStream('./png/' + uuid + '_2.png');
      
      
      /*
      pngdiff.outputDiffStream(image1, image2, true , function(err, outputStream, diffMetric) {
          if (err) throw err;
          if(diffMetric === 1){
              const outStream = new Writable({
                  write(chunk, encoding, callback) {
                      connection.send(chunk)
                  }
              });
              outputStream.pipe(base64.encode()).pipe(outStream)
              
              if (connection.isAlive) {
                  image1 = null
                  image2 = null      
                  sendNewImage(connection, uuid)
              } else
              { 
                  browsers[uuid] = null
                  connection.terminate()
              }
          }
          });
      */
  }
  
  async function sendKeyboard (connection, uuid, message) {
      const keyboard = browsers[uuid].keyboard
      if (message.key === 'ShiftDown') {
          await keyboard.down('Shift')
      }
      else if (message.key === 'ShiftUp') {
          await keyboard.up('Shift')
      }
      else {
          await keyboard.press(message.key)
      }
      //sendNewImage(connection, uuid)
      connection.send('typed letter ' + message.key)
  }
  
  async function sendClick (connection, uuid, message) {
      const mouse = browsers[uuid].page.mouse
      //await mouse.move(Number(message.x), Number(message.y));
      mouse.click(Number(message.x), Number(message.y), {
          "button": "left",
          "clickCount": 1,
          "delay": 0
      });
      //  sendNewImage(connection, uuid)
      connection.send('clicked')
  }
  
  async function sendBack (connection, uuid, message) {
      const page = browsers[uuid].page
      page.goBack();
  }
  
  async function sendForward (connection, uuid, message) {
      const page = browsers[uuid].page
      page.goForward();
  }
  
  const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();
  
      ws.isAlive = false;
      ws.ping(noop);
  });
  }, 30000);
  
  console.log('Server started @ 8081')

   })