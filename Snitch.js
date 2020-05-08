const WebSocket = require('ws');
const fs = require('fs');
const LineByLineReader = require('line-by-line');
const { Client, MessageEmbed } = require('discord.js');

const client = new Client(); //Discord client
const ws = new WebSocket('wss://ws.twist.moe', {origin: 'twist.moe'}); //Create a websocket

const activePath = __dirname;
const logPath = `${activePath}/logs/`;
const configPath = `${activePath}/config.json`;

let config;

// Check if files and config exsists
if (!fs.existsSync(logPath))
{
  console.log(`Couldnt find the folder ${logPath} creating now`)
  fs.mkdirSync(logPath);
  fs.openSync(`${logPath}/msg.log`, 'w');
}

if (fs.existsSync(configPath))
{
  configData = fs.readFileSync(configPath);
  config = JSON.parse(configData);
}
else
{
  console.log(`Couldnt read config file, creating a demo config file at ${configPath}.default`);
  config = {token:{at : "TOKEN", discord : "TOKEN"}, channel:{trigger : "ID",ban : "ID"}};
  fs.writeFileSync(`${configPath}.default`, JSON.stringify(config ,null ,2));
  process.exit()
}

MAX_CHAR = 1024; //Max msg char length

USR_MAP = new Map(); //Map of online users
REGEX_MAP = new Map(); //Map of regex for blacklisted words
SPAM = []; //Spam trigger array

//Word blacklist
REGEX_MAP.set("nigger", '\\b((n[^a]?(i+.?|!+.?))+)(g.?g+.?e+.?r+.?|g?.?g+.?l+.?e.?t.?)');
REGEX_MAP.set("mods", '^\/mods');
REGEX_MAP.set("pixie dick", 'pixie dick');
REGEX_MAP.set("chink",'\\b(chink)\\b');
REGEX_MAP.set("spic",'\\b(spic)\\b');
REGEX_MAP.set("grook",'\\b(grook)\\b');

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
  auth.content = config.token.at;
  ws.send(JSON.stringify(auth, null, 0));
});

//Discord login
client.login(config.token.discord);

//Record discord login
client.on('ready', () => {
  console.log(`Discord:Logged in as ${client.user.tag}!`);
});

//Send Discord message
function sendMsg(type, tag, username, message, timestamp, channel, log)
{
  //Parse a JSON object
  var msgReq = {
    "type": type,
    "content":
      {"user":
        {"username": username }
      ,"msg": message }
    ,"timestamp": timestamp,
    "error": "null",
  };

  client.channels.fetch(channel).then(channel =>{
    channel.send({embed:
    {
      color: 15844367,
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
        text: username + "@" + timestamp,
      }}
    });
  }).catch(err =>
  {
    msgReq.error = err;
    console.log(JSON.stringify(msgReq, null, 0) + "\n");
    fs.appendFileSync(`${logPath}/err.log` , JSON.stringify(msgReq, null, 0) + "\n");
  });
  fs.appendFileSync(`${logPath}/${log}`, JSON.stringify(msgReq, null, 0) + "\n");
}

function getTime(arg)
{
  var time = Date.now();
  var curTime = new Date(time).toLocaleTimeString("en-US");
  var curDate = new Date(time).toLocaleDateString("en-US");
  var timestamp = `${curDate}-${curTime}`;

  switch(arg)
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

client.on('message', msg => {
if (RegExp('^!').test(msg.content))
{
  var timestamp = getTime("stamp");
  var command = msg.content.substr(1);
  var args = command.split(" ");
  var input = command.substring(args[0].length + 1,command.length);

  switch(args[0])
  {

    case "ping":
      msg.channel.send({embed:
      {
        color: 15844367,
        title: "Pong!",
        description: "I'm alive."}
      });
    break;

    case "online":
      console.log("Discord:online");
      var output = [];
      for (const [key, value] of USR_MAP)
      {
        output.push(`${value}\t\t${key}`);
      }
      var msgOut = output.join("\n");
      var msgLen = msgOut.length;

      if (msgLen > MAX_CHAR)
      {
        msgOut = msgOut.substring(msgLen - MAX_CHAR,msgLen);
      }
      sendMsg("online" ,input ,msg.member ,msgOut ,timestamp ,msg.channel.id ,'discord.log');
    break;

    case "regex":
      var output = [];
      var timestamp = getTime("stamp")
      var lr = new LineByLineReader(`${logPath}/msg.log`);

      console.log(console.log(`Discord:test:${input}`));
      lr.on('line', function (line)
      {
        var msg = line.match('.*msg":"(.*)"},"time');
        try
        {
          if (RegExp(input).test(msg[1]))
          {
            output.push(msg[1]);
          }
        }
	catch(e)
        {
          console.log(`regex:${e}\n`);
          fs.appendFileSync(`${logPath}regex.log` , `regex:${e}\n`);
          lr.close();
        }
      });

      lr.on('end', function ()
      {
        var reqType = "regex";
        var msgOut = output.join("\n");
        var msgLen = msgOut.length;
        if (msgLen > 0)
        {
	  msgOut = msgOut.substring(msgLen - MAX_CHAR,msgLen);
          sendMsg(reqType , input, msg.member , msgOut , timestamp , msg.channel.id , 'discord.log');
        }
        else
        {
	  sendMsg(reqType , "Sorry!", msg.member , "Could not find a match for your regex :(" , timestamp , msg.channel.id , 'discord.log');
        }
      });
    break;

    case "add":

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
  switch(req.type)
  {
    case "client-add":
      console.log(`${req.type}:${req.content.username} has been added`);
      USR_MAP.set(req.content.username, getTime());
      fs.appendFileSync(`${logPath}/err.log` ,`${JSON.stringify(req, null, 0)}\n`);
    break;

    case "client-remove":
      if (USR_MAP.has(req.content.username))
      {
        console.log(`${req.type}:${req.content.username} has been removed`);
        USR_MAP.delete(req.content.username);
        fs.appendFileSync(`${logPath}/err.log` ,`${JSON.stringify(req, null, 0)}\n`);
      }
    break;

    case "msg":
      console.log(`${req.type}:${req.content.user.username}:${req.content.msg}`);
      fs.appendFileSync(`${logPath}/msg.log` ,`${JSON.stringify(req, null, 0)}\n`);

      for (const [key, value] of REGEX_MAP)
      {
        if (RegExp(value).test(req.content.msg.toLowerCase()))
        {
          sendMsg(req.type , key , req.content.user.username , req.content.msg, timestamp ,config.channel.trigger ,'trigger.log');
          break;
        }
      }
      for (let regex of SPAM)
      {
        if (RegExp(regex).test(req.content.msg.toLowerCase()))
        {
          sendMsg(req.type , "spam" , req.content.user.username , req.content.msg, timestamp ,config.channel.trigger ,'trigger.log');
          break;
        }
      }
    break;

    case "user":
      console.log(`${req.type}:${req.content.username} logged in`)
      fs.appendFileSync(`${logPath}/user.log` ,JSON.stringify(req, null, 0) + "\n");
    break;

    case "log":
      var log = req.content.split(" ");
      var shiMsg = log.shift();
      sendMsg(req.type , "Action", shiMsg, req.content, timestamp, config.channel.ban , 'mod.log');
    break;

    default:
      console.log(`${req.type}:not implemented`);
      req.error = `${req.type}:not implemented`;
      fs.appendFileSync(`${logPath}/err.log` ,JSON.stringify(req, null, 0) + "\n");
    break;
  }
});


//ERROR HANDLERS
process.on('unhandledRejection', err =>
{
  console.error('Unhandled promise rejection:', err);
  fs.appendFileSync(`${logPath}/err.log` , `Discord:${err}\n`);
});

client.on('shardError', error =>
{
  console.error('A websocket connection encountered an error:', error);
  fs.appendFileSync(`${logPath}/err.log` , `Discord:${err}\n`);
});
