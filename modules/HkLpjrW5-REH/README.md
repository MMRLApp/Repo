<a href="https://crates.io/crates/xh" noIcon>![Version info](https://img.shields.io/crates/v/xh.svg)</a>
<a href="https://repology.org/project/xh/versions" noIcon>![Packaging status](https://repology.org/badge/tiny-repos/xh.svg)</a>

`xh` is a friendly and fast tool for sending HTTP requests. It reimplements as much
as possible of [HTTPie's](https://httpie.io/) excellent design, with a focus
on improved performance.

<a href="https://asciinema.org/a/475190" noIcon>![asciicast](https://raw.githubusercontent.com/ducaale/xh/master/assets/xh-demo.gif)</a>

## Usage

Run `xh help` for more detailed information.

### Request Items

`xh` uses [HTTPie's request-item syntax](https://httpie.io/docs#request-items) to set headers, request body, query string, etc.

- `=`/`:=` for setting the request body's JSON or form fields (`=` for strings and `:=` for other JSON types).
- `==` for adding query strings.
- `@` for including files in multipart requests e.g `picture@hello.jpg` or `picture@hello.jpg;type=image/jpeg;filename=goodbye.jpg`.
- `:` for adding or removing headers e.g `connection:keep-alive` or `connection:`.
- `;` for including headers with empty values e.g `header-without-value;`.
- `=@`/`:=@` for setting the request body's JSON or form fields from a file (`=@` for strings and `:=@` for other JSON types).

The request body can also be read from standard input, or from a file using `@filename`.

### Shorthand form for URLs

Similar to HTTPie, specifying the scheme portion of the request URL is optional. `xh` also supports
omitting `localhost` from the URL as long it starts with colon plus an optional port number. 

```sh
xh http://localhost:3000/users # resolves to http://localhost:3000/users
xh localhost:3000/users        # resolves to http://localhost:3000/users
xh :3000/users                 # resolves to http://localhost:3000/users
xh :/users                     # resolves to http://localhost:80/users
xh example.com                 # resolves to http://example.com
xh ://example.com              # resolves to http://example.com
```

### Making HTTPS requests by default

`xh` will default to HTTPS scheme if the binary name is one of `xhs`, `https`, or `xhttps`. If you have installed `xh`
via a package manager, both `xh` and `xhs` should be available by default. Otherwise, you need to create one like this:

```sh
cd /path/to/xh && ln -s ./xh ./xhs
xh httpbin.org/get  # resolves to http://httpbin.org/get
xhs httpbin.org/get # resolves to https://httpbin.org/get
```

### Strict compatibility mode

If `xh` is invoked as `http` or `https` (by renaming the binary), or if the `XH_HTTPIE_COMPAT_MODE` environment variable is set,
it will run in HTTPie compatibility mode. The only current difference is that `--check-status` is not enabled by default.

## Examples

```sh
# Send a GET request
xh httpbin.org/json
# Send a POST request with body {"name": "ahmed", "age": 24}
xh httpbin.org/post name=ahmed age:=24
# Send a GET request with querystring id=5&sort=true
xh get httpbin.org/json id==5 sort==true
# Send a GET request and include a header named x-api-key with value 12345
xh get httpbin.org/json x-api-key:12345
# Send a PUT request and pipe the result to less
xh put httpbin.org/put id:=49 age:=25 | less
# Download and save to res.json
xh -d httpbin.org/json -o res.json
# Make a request with a custom user agent
xh httpbin.org/get user-agent:foobar
```

## How xh compares to HTTPie

### Advantages

- Improved startup speed.
- Available as a single statically linked binary that's easy to install and carry around.
- HTTP/2 support.
- Builtin translation to curl commands with the `--curl` flag.
- Short, cheatsheet-style output from `--help`. (For longer output, pass `help`.)

### Disadvantages

- Not all of HTTPie's features are implemented. ([#4](https://github.com/ducaale/xh/issues/4))
- Header names are not case-sensitive.
- No plugin system.
- General immaturity. HTTPie is old and well-tested.
- Worse documentation.

### Other differences

- `--check-status` is enabled unless `xh` is being used in
  [strict compatibility mode](https://github.com/ducaale/xh#strict-compatibility-mode).
- `rustls` is used by default instead of the system's TLS library. (If enabled at compile time, the `--native-tls` flag can be used.)
- JSON keys are not sorted.
- Formatted output is always UTF-8.

## Similar or related Projects

- [curlie](https://github.com/rs/curlie) - frontend to cURL that adds the ease of use of httpie
- [httpie-go](https://github.com/nojima/httpie-go) - httpie-like HTTP client written in Go
- [curl2httpie](https://github.com/dcb9/curl2httpie) - convert command arguments between cURL and HTTPie
