# EXIF module #

Defined in file `exif.js`.

Classes: **Reader**.

This JS module implements an EXIF data reader.

Example usage:
```
var File = require("fs").File;
var Reader = require("exif").Reader;
var imageData = new File("sample.jpg").open("r").read();

var reader = new Reader(imageData);         // parse and process
var allTags = reader.getTags();             // all present EXIF tags
system.stdout.writeLine(allTags["Model"]);  // camera model
```