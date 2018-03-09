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
var remoteProxyFun = "/ptth";

var remoteProxyIp = "srv-lzrwebp.193b.starter-ca-central-1.openshiftapps.com";
// var remoteProxyIp = "127.0.0.1";	// 测试用

var streq = "POST " + remoteProxyFun + " HTTP/1.1" +
"\r\nHost: " + remoteProxyIp +
// "\r\nConnection: keep-alive" +
// "\r\nOrigin: http://" + remoteProxyIp +
"\r\nContent-Type: application/x-www-form-urlencoded" +
"\r\nContent-Length: ";

console.log(streq.length);

// 解析请求头
function parseReq (buffer, e) {
	var i, j, k;
	var o = false;
	var txt = buffer.slice(0, e).toString("utf8");
	// console.log(txt);

	if (txt.substring(0, 8) === "CONNECT ") {
		i = 8;
		j = txt.indexOf(":", i);
		k = txt.indexOf(" ", j + 1);
		o = {
			host: txt.substring(i, j),
			port: txt.substring(j + 1, k) - 0,
			rok: "HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n"
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
			o.buf = utNode.addBuffer (
				new Buffer(s1 + "\r\nHost: " + s + s2 + "\r\nConnection: close"),
				buffer.slice(e)
			);
		}
	}

	// console.log ("------- " + o.host + ":" + o.port + "\n" + o.buf.toString());
	o.host = encodeURIComponent(o.host);
	return o;
}

// 从缓存中找到头部结束标记("\r\n\r\n")的位置
function bufferEnd(b)
{
	var i = 0;
	var len = b.length - 3;
	for(; i < len; i ++)
	{
		if (b[i] == 0x0d && b[i+1] == 0x0a && b[i+2] == 0x0d && b[i+3] == 0x0a) {
			return i;
		}
	}
	return -1;
}

// 数据处理
function rc(req, client) {
	//建立到目标服务器的连接
	var remoteProxy = net.createConnection(remoteProxyPort, remoteProxyIp);
	var o = "dat=" + JSON.stringify(req);
	var st = { t: 0, ts: null };

	remoteProxy.on("data", function(d) {
console.log("---");
		utNode.unpckBuffer(d, st, client);
console.log(req.host + ":" + req.port + " <<---- " + d.length);
	});
	client.on("data", function(d) {
		utNode.pckBuffer(d, streq, remoteProxy);
console.log(req.host + ":" + req.port + " >> " + d.length);
	});
	remoteProxy.on("end", function() {
		client.end();
console.log(req.host + ":" + req.port + " s - end");
	});
	client.on("end", function() {
		remoteProxy.end();
console.log(req.host + ":" + req.port + " c - end");
	});

	remoteProxy.on("error", function (e) {
console.log(222);
	});
	remoteProxy.write(new Buffer(streq + (o.length) + "\r\n\r\n" + o));
}

// 开启服务
net.createServer(function(client) {
	var buffer = new Buffer (0);

	client.on("error", function () {
console.log(111);
	});
	client.on("data", function (data) {
		buffer = utNode.addBuffer(buffer, data);
		var e = bufferEnd(buffer);
		if (e > 0) {
			var req = parseReq(buffer, e);
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
*/
