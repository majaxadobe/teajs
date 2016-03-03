# Apache configuration #

There are three main ways of using TeaJS with Apache. After you manage to prepare the configuration, go on by trying serving some [sample html](CodeSnippets.md).

**On windows, all necessary dlls must be available in system path!**

## 1. Apache module ##

This is the preferred way.

If you installed the libapache2-mod-teajs from teajs's PPA, just do
```
sudo a2enmod teajs
sudo /etc/init.d/apache2 restart
```
and you are all set. Otherwise:

  1. compile or download mod\_teajs (.dll on Windows, .so on Linux)
  1. load the resulting module into Apache:
```
LoadModule teajs_module /path/to/the/teajs_module.so
```
  1. assign a `teajs-script` handler as necessary
```
AddHandler teajs-script .ssjs .sjs
```
  1. optionally, you can specify a different config file for TeaJS in Apache's configuration file:
```
TeaJS_Config /path/to/teajs.conf
```

## 2. CGI binary - traditional approach ##

This variant is not specific to TeaJS. Apache configured in this way will just **execute** all assigned files (**.ssjs in the example below) and return output.**

```
AddHandler cgi-script .ssjs
```

Note that .ssjs files have to be executable (`chown +r`) and they must contain a valid [shebang line](http://en.wikipedia.org/wiki/Shebang_%28Unix%29) (`#!/path/to/tea`).

Windows users will find this approach problematic, as there is no way to execute arbitrary files with shebang on Windows.

## 3. CGI binary - centralized approach ##

This is the least preferred way.

```
ScriptAlias /teajs/ /YOUR_PATH/
AddHandler teajs-handler .ssjs
Action teajs-handler /teajs/BINARY_NAME
```

while substituting:
  * YOUR\_PATH with path to your TeaJS directory,
  * BINARY\_NAME with name of your "tea" binary.