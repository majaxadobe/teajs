# FastCGI support #

TeaJS does not ship with a FastCGI library, so no FCGI methods (such as `FCGI_Accept()`) can be exposed to user-land scripts. Instead, the whole TeaJS binary can act as a FCGI server (when compiled with `fcgi=1`). This allows for other means of communicating with a webserver, along with (plain old) CGI or Apache module approaches.