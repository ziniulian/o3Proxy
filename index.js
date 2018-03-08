// HTTP/HTTPS 代理

var net = require('net');
var http = require('http');

var srvIp = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var srvPort = process.env.OPENSHIFT_NODEJS_PORT || 8081;
var remoteProxyPort = 80;

var remoteProxyIp = "srv-lzrwebp.193b.starter-ca-central-1.openshiftapps.com";
// var remoteProxyIp = "127.0.0.1";	// 测试用

// var remoteProxyFun = "/reLinkDat";
var remoteProxyFun = "/ptth";
// var remoteProxyFun = "/testDat";	// 测试用

var streq = "POST " + remoteProxyFun + " HTTP/1.1" +
"\r\nHost: " + remoteProxyIp +
"\r\nConnection: keep-alive" +
"\r\nOrigin: http://" + remoteProxyIp +
"\r\nContent-Type: application/x-www-form-urlencoded" +
"\r\nContent-Length: ";

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
			o.buf = bufferAdd (
				new Buffer(s1 + "\r\nHost: " + s + s2 + "\r\nConnection: close"),
				buffer.slice(e)
			);
		}
	}

	// console.log ("------- " + o.host + ":" + o.port + "\n" + o.buf.toString());
	o.host = encodeURIComponent(o.host);
	o.port = encodeURIComponent(o.port);
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

// 两个buffer对象加起来
function bufferAdd(buf1,buf2)
{
	var re = new Buffer(buf1.length + buf2.length);
	buf1.copy(re);
	buf2.copy(re,buf1.length);
	return re;
}

// 数据处理
function rc(req, client) {
	//建立到目标服务器的连接
	var remoteProxy = net.createConnection(remoteProxyPort, remoteProxyIp);
	var o = "dat=" + JSON.stringify(req);
	var t = 0, ts="", tt;		// 状态：null，未操作；1，读取中

	remoteProxy.on("data", function(d) {
		if (ts) {
			// 有结束符 }，解析字段，发送给客户端，状态变回 t = 0, ts=""
			// 没有结束符，添加到ts里。
		} else {
			// 检查有没有起始符 \r\n\r\n{ ， 匹配一个字，t++，否则t为0
		}
		client.write(d);
console.log(req.host + ":" + req.port + " <<---- " + d.length);
	});
	client.on("data", function(d) {
		tt = JSON.stringify(d);
		remoteProxy.write(bufferAdd (new Buffer(streq + (tt.length) + "\r\n\r\n"), tt));
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

	remoteProxy.on("error", function (e) {});
	remoteProxy.write(new Buffer(streq + (o.length) + "\r\n\r\n" + o));
}

// // 数据处理
// function rc(req, client) {
// 	//建立到目标服务器的连接
// 	var o = encodeURIComponent(JSON.stringify(req));
// 	var remoteProxy = net.createConnection(remoteProxyPort, remoteProxyIp);
//
// 	var c = client;
// 	var s = remoteProxy;
// 	client.on("data", function(d) {
// 		remoteProxy.write(d);
// 	console.log(req.host + ":" + req.port + " >> " + d.length);
// 	});
// 	remoteProxy.on("data", function(d) {
// 		client.write(d);
// 	console.log(req.host + ":" + req.port + " <<---- " + d.length);
// 	});
// 	remoteProxy.on("end", function() {
// 		client.end();
// 	console.log(req.host + ":" + req.port + " s - end");
// 	});
// 	client.on("end", function() {
// 		remoteProxy.end();
// 	console.log(req.host + ":" + req.port + " c - end");
// 	});
//
//
// 	remoteProxy.on("error", function (e) {});
// 	remoteProxy.write(new Buffer(
// 		"POST " + remoteProxyFun + " HTTP/1.1" +
// 		"\r\nHost: " + remoteProxyIp +
// 		"\r\nConnection: keep-alive" +
// 		"\r\nContent-Length: " + (o.length + 4) +
// 		// "\r\nCache-Control: max-age=0" +	// 缓存机制
// 		"\r\nOrigin: http://" + remoteProxyIp +
// 		// "\r\nUpgrade-Insecure-Requests: 1" +	// http 与 https 的过度
// 		"\r\nContent-Type: application/x-www-form-urlencoded" +
// 		// "\r\nUser-Agent: Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.146 Safari/537.36" +
// 		// "\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8" +
// 		// "\r\nReferer: http://" + remoteProxyIp + "/test.html" +
// 		// "\r\nAccept-Encoding: gzip, deflate" +
// 		// "\r\nAccept-Language: zh-CN,zh;q=0.9" +
// 		// "\r\nCookie: 3ae6ed6dd3794e70fcd516d4263e17d4=127adb0ce847f37ae3e460f6ba8c4f1a; JSESSIONID=ykhJhhlHgJPtmvPLHLG7zhvvqfLv9lKmZ4W5YQj1MJn3TMnydhyf!-170224130" +
// 		// "\r\nCookie: 3ae6ed6dd3794e70fcd516d4263e17d4=127adb0ce847f37ae3e460f6ba8c4f1a; JSESSIONID=1QyZhhGRfshyQnTHXdxKvCfLQF3k2s4hnYBPT3khMhJdhbYMNLtQ!-170224130" +
// 		// "\r\nIf-None-Match: W/\"952-rhVyvXDpG9HNpuaFt/uPrZZ4vYI\"" +
// 		"\r\n\r\ndat=" + o
// 	));
// }

console.log(JSON.stringify(new Buffer ("{a}")));

// 开启服务
net.createServer(function(client) {
	var buffer = new Buffer (0);

	client.on("error", function () {});
	client.on("data", function (data) {
		buffer = bufferAdd(buffer, data);
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
