//Import dependencies
const WebSocket = require('ws'); //Websocket
const fs = require('fs'); //File server
const LineByLineReader = require('line-by-line'); //File stream manager
const { Client, MessageEmbed } = require('discord.js'); //Discord's API implementation
const File = require(`${__dirname}/File.js`); //File manager class

//Initiate dependencies
const client = new Client(); //Discord client
const ws = new WebSocket('wss://ws.twist.moe', { origin: 'twist.moe' }); //Create a websocket
const FILE = new File(); //File management class

//Set paths
const ACTIVE_PATH = __dirname; //Active directory
const LOG_PATH = `${ACTIVE_PATH}/logs`; //Log directory
const LIST_PATH = `${ACTIVE_PATH}/lists`; //List directory
const CONFIG_PATH = `${ACTIVE_PATH}/config.json`; //Config path

//Set constants
const MAX_CHAR = 1024; //Max msg char length
const EMBED_COLOR = 15844367; //Discord embeded message color
const PREFIX = "!"; //Discord commmand prefix

//Set global maps
var USR_MAP = new Map(); //Map of online users
var REGEX_MAP = new Map(); //Map of regex for blacklisted words

//Set global arrays
var SPAM = []; //Spam trigger array
var MESSAGES = []; //Message buffer

//Set global objects
var CONFIG = {}; //Config obj
var JSONbody = {};

//Check missing direcotries, create if doesnt exist
FILE.createMissingDir(LOG_PATH);
FILE.createMissingDir(LIST_PATH);

//Check missing files, create if doesnt exist
FILE.createMissingFile(`${LOG_PATH}/msg.log`);

//Create missing json files
JSONbody = { token: { at: "TOKEN", discord: "TOKEN" }, channel: { trigger: "ID", ban: "ID" } }; //Config Body
FILE.createJSONfile(CONFIG_PATH, `${CONFIG_PATH}.default`, JSONbody, true); //Create config if doesnt exist, then exit

JSONbody = { "key": "nigger", "value": "\\b((n[^a]?(i+.?|!+.?))+)(g.?g+.?e+.?r+.?|g?.?g+.?l+.?e.?t.?)" }; //Regex body
FILE.createJSONfile(LIST_PATH, `${LIST_PATH}/regex.json`, JSONbody, false); //Create regex if doesnt exist,

//Set globals from file
REGEX_MAP = FILE.JSONtoMap(`${LIST_PATH}/regex.json`);
CONFIG = FILE.importJSONfile(CONFIG_PATH, CONFIG);

//Set spam triggers
SPAM.push('(.)\\1{15,200}'); //reapted characthers
SPAM.push('(\\S+\\S+)(.?\\1){4,}'); //reapted words

//Auth as token on startup
ws.on('open', function open()
{
  let auth = new Object();
  auth.type = "auth";
  auth.content = CONFIG.token.at;
  ws.send(JSON.stringify(auth, null, 0));
});

//Discord login
client.login(CONFIG.token.discord);

//Record discord login
client.on('ready', () =>
{
  console.log(`Discord:Logged in as ${client.user.tag}!`);
});

//Send Discord message
function sendMsg(type, tag, username, message, timestamp, channel, log)
{
  //Parse a JSON object
  let msgReq = {
    "type": type,
    "content":
    {
      "user":
        { "username": username }
      , "msg": message
    }
    , "timestamp": timestamp,
    "error": "null",
  };
  //Parse message
  client.channels.fetch(channel).then(channel =>
  {
    channel.send({
      embed:
      {
        color: EMBED_COLOR,
        title: tag,
        fields:
          [
            {
              name: "Message",
              value: msgReq.content.msg,
              inline: true,
            },
          ],
        footer:
        {
          text: `${username}@${timestamp}`,
        }
      }
    });
  }).catch(err =>
  {
    msgReq.error = err; //Set request error
    console.log(`${JSON.stringify(msgReq, null, 0)}\n`); //Output request
    fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(msgReq, null, 0)}\n`); //Write request to error log
  });
  fs.appendFileSync(`${LOG_PATH}/${log}`, `${JSON.stringify(msgReq, null, 0)}\n`); //Write request to log
}

function santizeMsg(output)
{
  let msgOut = output.join("\n"); //
  msgOut = msgOut.replace(/\*/g, "\\\*");
  let msgLen = msgOut.length;

  if (msgLen > MAX_CHAR)
  {
    msgOut = msgOut.substring(msgLen - MAX_CHAR, msgLen);
  }
  return msgOut;
}

function getTime(arg)
{
  let time = Date.now();
  let curTime = new Date(time).toLocaleTimeString("en-US");
  let curDate = new Date(time).toLocaleDateString("en-US");
  let timestamp = `${curDate}-${curTime}`;

  switch (arg)
  {
    case "stamp":
      return timestamp;
      break;
    case "date":
      return curDate;
      break;
    default:
      return curTime;
      break;
  }
}

client.on('message', msg =>
{
  //If it's a command
  if (RegExp(`^${PREFIX}`).test(msg.content))
  {
    let timestamp = getTime("stamp"); //Set timestamp
    let output = []; //Local array for outputs

    let command = msg.content.substr(1); //Full user input, includes the command
    let args = command.split(" "); //Split user input
    let input = command.substring(args[0].length + 1, command.length);//Full user input, excludes the command

    //Command handler
    switch (args[0])
    {
      case "ping":
        msg.channel.send(
          {
            embed:
            {
              color: EMBED_COLOR,
              title: "Pong!",
              description: "I'm alive."
            }
          });
        break;

      case "ban":
        
        break;

      case "online":
        console.log("Discord:online");
        for (const [key, value] of USR_MAP)
        {
          output.push(`${value}\t\t${key}`);
        }
        sendMsg(args[0], input, msg.member, santizeMsg(output), timestamp, msg.channel.id, 'discord.log');
        break;

      case "regexlist":
        for (const [key, value] of REGEX_MAP)
        {
          output.push(`${key}~${value}`);
        }
        sendMsg(args[0], input, msg.member, santizeMsg(output), timestamp, msg.channel.id, 'discord.log');
        break;

      case "regex":
        let lr = new LineByLineReader(`${LOG_PATH}/msg.log`, { encoding: 'utf8', skipEmptyLines: true });

        console.log(console.log(`Discord:test:${input}`));
        lr.on('line', function (line)
        {
          let data = JSON.parse(line);
          try
          {
            if (RegExp(input).test(data.content.msg.toLowerCase()))
            {
              data.content.user.username = data.content.user.username.replace(/\*/g, "\\\*");
              data.content.msg = data.content.msg.replace(/\*/g, "\\\*");
              output.push(`${data.content.user.username}:${data.content.msg}`);
            }
          }
          catch (err)
          {
            console.log(`regex:${err}\n`);
            fs.appendFileSync(`${LOG_PATH}/regex.log`, `regex:${err}\n`);
            lr.close();
            lr.end();
          }
        });

        lr.on('end', function ()
        {
          let msgOut = output.join("\n");
          msgOut = santizeMsg(output);
          let msgLen = msgOut.length;

          if (msgLen > 0)
          {
            sendMsg(args[0], input, msg.member, msgOut, timestamp, msg.channel.id, 'discord.log');
          }
          else
          {
            sendMsg(args[0], "Sorry!", msg.member, "Could not find a match for your regex :(", timestamp, msg.channel.id, 'discord.log');
          }
        });
        break;

      case "regexset":
        let msgOut = "";
        let tag = "";
        input = input.split('~');

        let regTag = input[0];
        let regExp = input[1];

        try
        {
          REGEX_MAP.set(regTag, regExp);
          if (regExp.length > 0)
          {
            FILE.mapToJSON(`${LIST_PATH}/regex.json`, REGEX_MAP);
            tag = "Success!";
            msgOut = `${regTag} sucessfully set to ${regExp}`;
          }
          else
          {
            tag = "Sorry!";
            msgOut = `Failed to set ${regTag} to ${regExp} in the trigger list :(`;
          }
        }
        catch (err)
        {
          tag = "Sorry!";
          msgOut = `Failed to set the trigger list :(\n${err}`;
        }
        sendMsg(args[0], tag, msg.member, msgOut, timestamp, msg.channel.id, 'discord.log');
        break;

      case "regexload":
        msgOut = "Loaded regex";
        tag = "Success!";

        try
        {
          REGEX_MAP.clear();
          REGEX_MAP = FILE.JSONtoMap(`${LIST_PATH}/regex.json`);
        }
        catch (err)
        {
          msgOut = `Couldn't load regex ${err}`;
          tag = "Sorry!";
        }
        sendMsg(args[0], tag, msg.member, msgOut, timestamp, msg.channel.id, 'discord.log');
        break;

      case "regexdel":
        msgOut = "Deleted regex";
        tag = "Success!";

        try
        {
          REGEX_MAP.delete(input);
          FILE.mapToJSON(`${LIST_PATH}/regex.json`, REGEX_MAP);
        }
        catch (err)
        {
          msgOut = `Couldn't delete regex ${err}`;
          tag = "Sorry!";
        }
        sendMsg(args[0], tag, msg.member, msgOut, timestamp, msg.channel.id, 'discord.log');
        break;
    }
  }
});


ws.on('message', function incoming(data)
{
  req = JSON.parse(data);
  let timestamp = getTime("stamp");

  function matchOwn(regex, results)
  {
    if (RegExp(regex).test(req.content.user.username))
    {
      results.push(req.content.msg);
    }
  }

  //REQUEST HANDLERS
  switch (req.type)
  {
    case "client-add":
      console.log(`${req.type}:${req.content.username} has been added`);
      USR_MAP.set(req.content.username, getTime());
      fs.appendFileSync(`${LOG_PATH}/action.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;

    case "client-remove":
      if (USR_MAP.has(req.content.username))
      {
        console.log(`${req.type}:${req.content.username} has been removed`);
        USR_MAP.delete(req.content.username);
        fs.appendFileSync(`${LOG_PATH}/action.log`, `${JSON.stringify(req, null, 0)}\n`);
      }
      break;

    case "msg":
      console.log(`${req.type}:${req.content.user.username}:${req.content.msg}`);

      for (const [key, value] of REGEX_MAP)
      {
        if (RegExp(value).test(req.content.msg.toLowerCase()))
        {
          sendMsg(req.type, key, req.content.user.username, req.content.msg, timestamp, CONFIG.channel.trigger, 'trigger.log');
          break;
        }
      }
      for (let regex of SPAM)
      {
        if (RegExp(regex).test(req.content.msg.toLowerCase()))
        {
          sendMsg(req.type, "spam", req.content.user.username, req.content.msg, timestamp, CONFIG.channel.trigger, 'trigger.log');
          break;
        }
      }

      let usrMsg = 0;
      //let lrgMsg = 0;
      let maxMsgs = 7; //
      let maxlength = 200; //max message length on site chat at time of writing
      let maxMsgscurlength = 0;
      let maxtotalpt = 1400; // maxMsgs*maxlength
      let curpt = 0;//total 

      let trigMsg = false;
      let logMsg = "";
      let tagMsg = "";

      let wsOBJ = new Object();
      wsOBJ.type = "msg";

      for (let objOut of MESSAGES)
      {
        let objUsr = objOut.content.user.username;
        let objMsg = objOut.content.msg;


        if (req.content.user.username == objUsr)
        {
          ++usrMsg;
          maxMsgscurlength += req.content.msg.length

          /*if (req.content.msg.length > 100)
          {
            ++lrgMsg;
            
          }*/
          if (usrMsg == maxMsgs ||usrMsg == maxMsgs + 1|| usrMsg == maxMsgs - 2) //lol
          {
            trigMsg = true;
            logMsg = `Spam warn:${req.content.user.username}`;
            wsOBJ.content = `/warn ${req.content.user.username} for slow down please`; //please, you've typed 5 rows already.
          }
          else if (usrMsg > maxMsgs)
          {
            //if (lrgMsg > maxMsgs)
            if(usrMsg = 9)//chat buffer max is 9 //you're spamming nearly empty lines, so we just manually set the time to be a dayban, or half the max length of spamming with large messages
            {
              trigMsg = true;
              logMsg = `Spam ban:${req.content.user.username}:${req.content.msg}`;
              wsOBJ.content = `/ban ${req.content.user.username} 15 for spam | 15 minutes`; //1440 seemed too harsh, 15 might not be enough but we can increase it later. This is the easiest one to accidentally trigger without time being accounted for at certain times of the day but people will recieve 3 warnings before this point
            }
             
            else if (maxMsgscurlength > (maxtotalpt*0.5)) 
            {
              curpt==(maxtotalpt*maxMsgscurlength*0.01/maxMsgs) //quite naughty, at minimum a dayban, max 2 days, though this is simply based on 1400 being close enough to 1440 that nobody cares
              trigMsg = true;
              logMsg = `MassSpam:${req.content.user.username}:${req.content.msg}`;
              wsOBJ.content = `/ban ${req.content.user.username} ${curpt} for spam | ${curpt} minutes`; //Byebye juzo
              MESSAGES = [];
            }
            else if (maxMsgscurlength > (maxtotalpt*0.25)) //key here is people can still post below a quarter volume per post when averaged out over 7 posts
            {
              curpt==(maxtotalpt*maxMsgscurlength*0.0001/maxMsgs) //just a little naughty
              trigMsg = true;
              logMsg = `Spam ban:${req.content.user.username}:${req.content.msg}`;
              wsOBJ.content = `/ban ${req.content.user.username} ${curpt} for spam | ${curpt} minutes`;
            }
          }
        }
      }
      if (trigMsg)
      {
        console.log(logMsg);
        ws.send(JSON.stringify(wsOBJ, null, 0));
        trigMsg = false;
      }
      usrMsg = 0;
      lrgMsg = 0;

      //Chat buffer
      if (9 > MESSAGES.length)
      {
        MESSAGES.push(req);
      }
      else
      {
        MESSAGES.shift();
        MESSAGES.push(req);
      }

      fs.appendFileSync(`${LOG_PATH}/msg.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;

    case "user":
      console.log(`${req.type}:${req.content.username} logged in`);
      break;

    case "log":
      let log = req.content.split(" ");
      sendMsg(req.type, "Action", log[0], req.content, timestamp, CONFIG.channel.ban, 'mod.log');
      break;

    case "warning":
      req.error = `${req.type}:${req.content}`;
      fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;

    default:
      console.log(`${req.type}:not implemented`);
      req.error = `${req.type}:not implemented`;
      fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;
  }
});


//ERROR HANDLERS
process.on('unhandledRejection', err =>
{
  console.error('Unhandled promise rejection:', err);
  fs.appendFileSync(`${LOG_PATH}/err.log`, `Discord:${err}\n`);
});

client.on('shardError', error =>
{
  console.error('A websocket connection encountered an error:', error);
  fs.appendFileSync(`${LOG_PATH}/err.log`, `Discord:${err}\n`);
});
