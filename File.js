const fs = require('fs');
const LineByLineReader = require('line-by-line');

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

module.exports = File