// HTTP/HTTPS 代理

var net = require('net');

var srvIp = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var srvPort = process.env.OPENSHIFT_NODEJS_PORT || 8080;

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
			typ: "https",
			buf: new Buffer("HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n")
		};
	} else {
		i = txt.indexOf("\r\nHost:");
		if (i !== -1) {
			var s1 = txt.substring(0, i);
			var s, s2;
			o = {
				typ: "http"
			};

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
			rc(req);
		}
	});

	//从http请求头部取得请求信息后，继续监听浏览器发送数据，同时连接目标服务器，并把目标服务器的数据传给浏览器
	function rc(req) {
		//建立到目标服务器的连接
		var server = net.createConnection(req.port, req.host);

		//交换服务器与浏览器的数据
		client.on("data", function(data){ server.write(data); });
		server.on("data", function(data){ client.write(data); });
		client.on("end", function () { server.end(); });
		server.on("end", function () { client.end(); });
		server.on("error", function () {});

		switch (req.typ) {
			case "http":
				server.write(req.buf);
				break;
			case "https":
				client.write(req.buf);
				break;
		}
	}
}).listen(srvPort, srvIp);
console.log("LZRproxy start " + srvIp + ":" + srvPort);
