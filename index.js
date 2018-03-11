// HTTP/HTTPS 代理

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
var remoteProxyFunHttps = "POST /ptths";		// https请求
var remoteProxyFunHttpsDat = "POST /ptthsDat/";	// https数据交互

// var remoteProxyIp = "srv-lzrwebp.193b.starter-ca-central-1.openshiftapps.com";
var remoteProxyIp = "127.0.0.1";	// 测试用

var streq = " HTTP/1.1\r\nHost: " + remoteProxyIp +
"\r\nContent-Type: application/x-www-form-urlencoded" +
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
				Buffer.from(s1 + "\r\nHost: " + s + s2 + "\r\nConnection: close"),
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
	var st = { t: 0, ts: null };
	var o = Buffer.from("{\"h\":\"" + encodeURIComponent(req.host) + "\",\"p\":" + req.port + "}");

	client.on("end", function() {
		remoteProxy.end();
console.log(req.host + ":" + req.port + " c - end");
	});
	remoteProxy.on("error", function (e) {});

	if (req.buf) {
		// HTTP
		remoteProxy.on("data", function(d) {
			// 需确认不发送 Content-Length 接收到的多次应答，是否每次都要 HTTP 头才能够通过 openshift 的监控
			// getHttpDat(d, st, client);
console.log(req.host + ":" + req.port + " <<---- " + d.length);
		});
		client.on("data", function(d) {
			client.end();
console.log(req.host + ":" + req.port + " >> 服务端已关闭连接，不能再次发送请求。");
		});
		remoteProxy.on("end", function() {
			client.end();
console.log(req.host + ":" + req.port + " s - end");
		});
		remoteProxy.write(Buffer.concat([
			Buffer.from(remoteProxyFunHttp + streq + o.length + "\r\n\r\n"),
			o, req.buf
		]));
	} else {
		// HTTPS
		var key = 0;
		remoteProxy.on("data", function(d) {
			// 获取 key ...
			client.write(Buffer.from("HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n"));
			remoteProxy.end();
console.log(req.host + ":" + req.port + " <<---- https 连接OK" + d.length);
		});
		client.on("data", function(d) {
			// 重建连接，发送数据 ...
console.log(req.host + ":" + req.port + " >> " + d.length);
		});
		remoteProxy.write(Buffer.concat([
			Buffer.from(remoteProxyFunHttps + streq + o.length + "\r\n\r\n"),
			o, req.buf
		]));
	}

}

// 开启服务
net.createServer(function(client) {
	var buf = Buffer.allocUnsafe(0);

	client.on("error", function () {});
	client.on("data", function (dat) {
		buf = Buffer.concat([buf, dat]);
		var e = buf.indexOf("\r\n");
		if (e > 0) {
			var req = parseReq(buf, e);
			if (req === false) return;
			client.removeAllListeners("data");
			rc(req, client);
		}
	});
}).listen(srvPort, srvIp);
console.log("间接代理启动 " + srvIp + ":" + srvPort);


/*
BUG :
	1. http 返回的数据被打断，则自动结束，不再发送。
	2. https 百度、谷歌 时无效。
	以上两 bug 可能都是由于一次请求不能两次发送的原因。

	3. openshift 访问控制机制：
		一次请求 只能对应 一次应答，应答时的 Content-Length: 很重要，多于应答数则不接收请求，少于等于应答数则不再次应答。
		若没有 Content-Length，则不再接受第二次请求，但能够无限应答。

		解决对策：全部不回传 Content-Length 。https交互，每次都发送一个新的POST请求来处理。
*/
