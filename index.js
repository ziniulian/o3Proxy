// HTTP/HTTPS 间接代理

// LZR 模块加载
require("lzr");

var net = require('net');

// LZR 子模块加载
LZR.load([
	"LZR.Node.Util"
]);
var utNode = LZR.getSingleton(LZR.Node.Util);

var srvIp = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var srvPort = process.env.OPENSHIFT_NODEJS_PORT || 8081;
var remoteProxyPort = 80;
var remoteProxyFunHttp = "POST /ptth";		// http请求
var remoteProxyFunHttps = "POST /ptths/";	// https数据交互

var remoteProxyIp = "srv-lzrwebp.193b.starter-ca-central-1.openshiftapps.com";
// var remoteProxyIp = "127.0.0.1";	// 测试用

var streq = " HTTP/1.1\r\nHost: " + remoteProxyIp +
"\r\nContent-Length: ";

// 解析请求头
function parseReq (buf, e) {
	var i, j, k;
	var o = false;
	var txt = buf.slice(0, e).toString("utf8");
	// console.log(txt);

	if (txt.substring(0, 8) === "CONNECT ") {
		i = 8;
		j = txt.indexOf(":", i);
		k = txt.indexOf(" ", j + 1);
		o = {
			host: txt.substring(i, j),
			port: txt.substring(j + 1, k) - 0
		};
	} else {
		i = txt.indexOf("\r\nHost:");
		if (i !== -1) {
			var s1 = txt.substring(0, i);
			var s, s2;
			o = {};

			// 替换网址格式(去掉域名部分)
			if (txt[i-1] === "1") {
				j = s1.indexOf("http://");
				if (j > 0) {
					k = s1.indexOf ("/", (j + 7));
					s1 = txt.substr(0, j) + s1.substr(k);
				}
			}

			// 抓取域名部分
			i += 7;
			while (txt[i] === " ") {
				i ++;
			}
			j = txt.indexOf("\r\n", i);
			if (j === -1) {
				s = txt.substring(i);
				s2 = "";
			} else {
				s = txt.substring(i, j);

				// 替换connection头
				s2 = txt.substring(j)
					.replace(/(Proxy\-)?Connection\:.+\r\n/ig,"")
					.replace(/Keep\-Alive\:.+\r\n/i,"");
			}

			// 解析域名和端口
			k = s.indexOf(":");
			if (k === -1) {
				o.host = s;
				o.port = 80;
			} else {
				o.host = s.substring(0, k);
				o.port = (s.substring(k + 1) - 0);
			}

			// 替换buffer
			o.buf = Buffer.concat([
				new Buffer(s1 + "\r\nHost: " + s + s2 + "\r\nConnection: close"),
				buf.slice(e)
			]);
		}
	}

	// console.log ("------- " + o.host + ":" + o.port + "\n" + o.buf.toString());
	return o;
}

// 数据处理
function rc(req, client) {
	//建立到目标服务器的连接
	var remoteProxy = net.createConnection(remoteProxyPort, remoteProxyIp);
	var buf = new Buffer(0);
	var o = "{\"h\":\"" + req.host + "\",\"p\":" + req.port;

	client.on("end", function() {
		remoteProxy.end();
// console.log(req.host + ":" + req.port + " c - end");
	});
	remoteProxy.on("error", function (e) {
		remoteProxy.end();
		client.end();
// console.log(req.host + ":" + req.port + " s - err");
	});

	if (req.buf) {
		// HTTP
		var b = false;
		remoteProxy.on("data", function(dat) {
			if (b) {
				client.write(dat);
			} else {
				buf = Buffer.concat([buf, dat]);
				var e = buf.indexOf("\r\n\r\n\t<w*p>\t");
				if (e > 0) {
// console.log(buf.slice(0, e).toString());
					b = true;
					client.write(buf.slice(e + 11));
				}
			}
// console.log(req.host + ":" + req.port + " <<---- " + dat.length);
		});
		client.on("data", function(dat) {
			client.end();
// console.log(req.host + ":" + req.port + " >> 服务端已关闭连接，不能再次发送请求。");
		});
		remoteProxy.on("end", function() {
			client.end();
// console.log(req.host + ":" + req.port + " s - end");
		});

		o += "}";
		remoteProxy.write(Buffer.concat([
			new Buffer(remoteProxyFunHttp + streq + (o.length + req.buf.length) + "\r\n\r\n" + o),
			req.buf
		]));
	} else {
		// HTTPS
		var key = "";
		var id = 0;
		remoteProxy.on("data", function(dat) {
			buf = Buffer.concat([buf, dat]);
			var e = buf.indexOf("\r\n\r\n");
			if (e > 0) {
				key = buf.slice(e + 4).toString();
				remoteProxy.end();
				client.write(new Buffer("HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n"));
			}
// console.log(req.host + ":" + req.port + " <<---- https 连接OK , " + key);
		});
		client.on("data", function(dat) {
			rcs(dat, key, id, client);
// console.log(key + "-" + id + ": >> " + dat.length);
			id ++;
		});

		o += ",\"k\":1}";
		remoteProxy.write(new Buffer(remoteProxyFunHttp + streq + o.length + "\r\n\r\n" + o));
	}
}

// https 数据处理
function rcs(dat, key, id, client) {
	var remoteProxy = net.createConnection(remoteProxyPort, remoteProxyIp);
	var buf = new Buffer(0);
	var b = false;

	remoteProxy.on("data", function(dat) {
		if (b) {
			client.write(dat);
		} else {
			buf = Buffer.concat([buf, dat]);
			var e = buf.indexOf("\r\n\r\n\t<w*p>\t");
			if (e > 0) {
// console.log(buf.slice(0, e).toString());
				b = true;
				client.write(buf.slice(e + 11));
			}
		}
// console.log(key + "-" + id + ": <<---- " + dat.length);
	});
	remoteProxy.on("error", function (e) {
		remoteProxy.end();
		client.end();
// console.log(key + "-" + id + ": s - err");
	});

	remoteProxy.write(Buffer.concat([
		new Buffer(remoteProxyFunHttps + key + "/" + id + streq + dat.length + "\r\n\r\n"),
		dat
	]));
}

// 开启服务
net.createServer(function(client) {
	var buf = new Buffer(0);

	client.on("error", function () {});
	client.on("data", function (dat) {
		buf = Buffer.concat([buf, dat]);
		var e = buf.indexOf("\r\n\r\n");
		if (e > 0) {
			var req = parseReq(buf, e);
			if (req === false) return;
			client.removeAllListeners("data");
			rc(req, client);
		}
	});
}).listen(srvPort, srvIp);
console.log("间接代理启动 " + srvIp + ":" + srvPort);
