const WebSocket = require('ws');
const fs = require('fs');
const LineByLineReader = require('line-by-line');
const { Client, MessageEmbed } = require('discord.js');

const client = new Client(); //Discord client
const ws = new WebSocket('wss://ws.twist.moe', { origin: 'twist.moe' }); //Create a websocket

const ACTIVE_PATH = __dirname;
const LOG_PATH = `${ACTIVE_PATH}/logs`;
const LIST_PATH = `${ACTIVE_PATH}/lists`;
const CONFIG_PATH = `${ACTIVE_PATH}/config.json`;

MAX_CHAR = 1024; //Max msg char length
EMBED_COLOR = 15844367;

USR_MAP = new Map(); //Map of online users
REGEX_MAP = new Map(); //Map of regex for blacklisted words
SPAM = []; //Spam trigger array
let CONFIG = {};

class File
{
  createMissingDir(path)
  {
    if (!fs.existsSync(path))
    {
      console.log(`Couldnt find the folder ${path} creating now`);
      fs.mkdirSync(path);
    }
  }

  createMissingFile(path)
  {
    if (!fs.existsSync(path))
    {
      console.log(`Couldnt find the file ${path} creating now`);
      fs.openSync(path, 'w');
    }
  }

  importJSONfile(path, JSONobj)
  {
    if (fs.existsSync(path))
    {
      var fileData = fs.readFileSync(path);
      JSONobj = JSON.parse(fileData);
      return JSONobj;
    }
  }

  createJSONfile(path, file, JSONobj, exitCode)
  {
    if (!fs.existsSync(path))
    {
      console.log(`Creating a file at ${path}`);
      fs.writeFileSync(file, JSON.stringify(JSONobj, null, 2));
      if (exitCode)
      {
        process.exit();
      }
    }
  }

  mapToJSON(path, map)
  {
    fs.openSync(path, 'w');
    for (const [key, value] of map)
    {
      var body =
      {
        key: key,
        value: value
      };
      var JSONstr = JSON.stringify(body);
      fs.appendFileSync(path, `${JSONstr}\n`);
    }
  }

  JSONtoMap(path)
  {
    var lr = new LineByLineReader(path, { encoding: 'utf8', skipEmptyLines: true });
    let outMap = new Map();

    lr.on('line', function (line)
    {
      try
      {
        var data = JSON.parse(line);
        outMap.set(data.key, data.value);
      }
      catch (err)
      {
        console.log(`JSONtoMap:${err}\n`);
        lr.close();
        lr.end();
      }
    });
    return outMap;
  }
}
const FILE = new File();

FILE.createMissingDir(LOG_PATH);
FILE.createMissingDir(LIST_PATH);

FILE.createMissingFile(`${LOG_PATH}/msg.log`);

var configBody = { token: { at: "TOKEN", discord: "TOKEN" }, channel: { trigger: "ID", ban: "ID" } };
FILE.createJSONfile(CONFIG_PATH, `${CONFIG_PATH}.default`, configBody, true);

var configBody = {"key":"nigger","value":"\\b((n[^a]?(i+.?|!+.?))+)(g.?g+.?e+.?r+.?|g?.?g+.?l+.?e.?t.?)"};
FILE.createJSONfile(LIST_PATH, `${LIST_PATH}/regex.json`, configBody, false);

REGEX_MAP = FILE.JSONtoMap(`${LIST_PATH}/regex.json`);
CONFIG = FILE.importJSONfile(CONFIG_PATH, CONFIG);

//Spam triggers
SPAM.push('(.)\\1{15,200}'); //reapted characthers
SPAM.push('(\\w+\\w+)(.?\1){4,}'); //reapted words
SPAM.push('\\w{16,}');
SPAM.push('.{150,}');

//Auth as token on startup
ws.on('open', function open()
{
  var auth = new Object();
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
  var msgReq = {
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
    msgReq.error = err;
    console.log(`${JSON.stringify(msgReq, null, 0)}\n`);
    fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(msgReq, null, 0)}\n`);
  });
  fs.appendFileSync(`${LOG_PATH}/${log}`, `${JSON.stringify(msgReq, null, 0)}\n`);
}

function santizeMsg(output)
{
  var msgOut = output.join("\n");
  msgOut = msgOut.replace(/\*/g, "\\\*");
  var msgLen = msgOut.length;

  if (msgLen > MAX_CHAR)
  {
    msgOut = msgOut.substring(msgLen - MAX_CHAR, msgLen);
  }
  return msgOut;
}

function getTime(arg)
{
  var time = Date.now();
  var curTime = new Date(time).toLocaleTimeString("en-US");
  var curDate = new Date(time).toLocaleDateString("en-US");
  var timestamp = `${curDate}-${curTime}`;

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
  if (RegExp('^!').test(msg.content))
  {
    var timestamp = getTime("stamp");
    var command = msg.content.substr(1);
    var args = command.split(" ");
    var input = command.substring(args[0].length + 1, command.length);

    switch (args[0])
    {

      case "ping":
        msg.channel.send({
          embed:
          {
            color: EMBED_COLOR,
            title: "Pong!",
            description: "I'm alive."
          }
        });
        break;

      case "online":
        console.log("Discord:online");
        var output = [];
        for (const [key, value] of USR_MAP)
        {
          output.push(`${value}\t\t${key}`);
        }
        sendMsg(args[0], input, msg.member, santizeMsg(output), timestamp, msg.channel.id, 'discord.log');
        break;

      case "regexlist":
        output = [];
        for (const [key, value] of REGEX_MAP)
        {
          output.push(`${key}~${value}`);
        }
        sendMsg(args[0], input, msg.member, santizeMsg(output), timestamp, msg.channel.id, 'discord.log');
        break;

      case "regex":
        var output = [];
        var timestamp = getTime("stamp");
        var lr = new LineByLineReader(`${LOG_PATH}/msg.log`, { encoding: 'utf8', skipEmptyLines: true });

        console.log(console.log(`Discord:test:${input}`));
        lr.on('line', function (line)
        {
          var data = JSON.parse(line);
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
          var msgOut = output.join("\n");
          msgOut = santizeMsg(output);
          var msgLen = msgOut.length;

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
        var msgOut = "";
        var tag = "";
        input = input.split('~');
        regTag = input[0];
        regExp = input[1];

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
  var timestamp = getTime("stamp");

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
      fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;

    case "client-remove":
      if (USR_MAP.has(req.content.username))
      {
        console.log(`${req.type}:${req.content.username} has been removed`);
        USR_MAP.delete(req.content.username);
        fs.appendFileSync(`${LOG_PATH}/err.log`, `${JSON.stringify(req, null, 0)}\n`);
      }
      break;

    case "msg":
      console.log(`${req.type}:${req.content.user.username}:${req.content.msg}`);
      fs.appendFileSync(`${LOG_PATH}/msg.log`, `${JSON.stringify(req, null, 0)}\n`);

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
      break;

    case "user":
      console.log(`${req.type}:${req.content.username} logged in`);
      fs.appendFileSync(`${LOG_PATH}/user.log`, `${JSON.stringify(req, null, 0)}\n`);
      break;

    case "log":
      var log = req.content.split(" ");
      var shiMsg = log.shift();
      sendMsg(req.type, "Action", shiMsg, req.content, timestamp, CONFIG.channel.ban, 'mod.log');
      break;

    case "warning":
      req.error = `${req.type}:auth failed!`;
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
