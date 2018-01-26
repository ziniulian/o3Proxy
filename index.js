var net = require('net');

var srvip = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var srvport = process.env.OPENSHIFT_NODEJS_PORT || 8080;

// 解析请求头
function parseReq (buffer, e) {
	var i, j, s, typ;
	var txt = buffer.slice(0, e).toString("utf8");

	if (txt.substr(0, 8) === "CONNECT ") {
		i = 8;
		j = txt.indexOf(" ", i);
		typ = "https";
	} else {
		typ = "http";
		i = txt.indexOf("\r\nHost:");
		if (txt[i-1] === "1") {
			console.log(txt.substr(i-8, 8)); // ...........
		}
		i += 6;
		if (i === -1) {
			return null;
		}
		while (txt[i] === " ") {
			i ++;
		}
		j = txt.indexOf("\r\n", i);
	}
	if (j === -1) {
		s = txt.substring(i);
	} else {
		s = txt.substring(i, j);
	}
	// console.log([s]);

	i = s.split(":");
	return {
		host: i[0],
		port: (i[1] - 0) || 80,
		typ: typ
	};
};

// 从缓存中找到头部结束标记("\r\n\r\n")的位置
function bufferEnd(b)
{
	var i = 0;
	var len = b.length - 3;
	for(; i < len; i ++)
	{
		if (b[i] == 0x0d && b[i+1] == 0x0a && b[i+2] == 0x0d && b[i+3] == 0x0a) {
			return i+4;
		}
	}
	return -1;
}

net.createServer(function(client) {
	var buffer = new Buffer (0);

	client.on("data", function (data) {
		buffer = buffer.concat(data);
		var e = bufferEnd(buffer);
		if (e > 0) {
			var req = parseReq(buffer, e);
			if (req === false) return;
			client.removeAllListeners('data');
			relay_connection(req);
		}
	});

	// client.on("end", function () {
	// 	console.log("--- 本地 END!");
	// });
    // client.on("close", function(data) {
    //     console.log("--- Closed!");
    // });
	// client.on("error", function () {
	// 	console.log("--- Err!");
	// });

	//从http请求头部取得请求信息后，继续监听浏览器发送数据，同时连接目标服务器，并把目标服务器的数据传给浏览器
	function relay_connection(req)
	{
		// console.log(req.method+' '+req.host+':'+req.port);

		//如果请求不是CONNECT方法（GET, POST），那么替换掉头部的一些东西
		if (req.method != 'CONNECT')
		{
			//先从buffer中取出头部
			var _body_pos = buffer_find_body(buffer);
			if (_body_pos < 0) _body_pos = buffer.length;
			var header = buffer.slice(0,_body_pos).toString('utf8');
			//替换connection头
			header = header.replace(/(proxy\-)?connection\:.+\r\n/ig,'')
					.replace(/Keep\-Alive\:.+\r\n/i,'')
					.replace("\r\n",'\r\nConnection: close\r\n');
			//替换网址格式(去掉域名部分)
			if (req.httpVersion == '1.1')
			{
				var url = req.path.replace(/http\:\/\/[^\/]+/,'');
				if (url.path != url) header = header.replace(req.path,url);
			}
			buffer = buffer_add(new Buffer(header,'utf8'),buffer.slice(_body_pos));
		}

		//建立到目标服务器的连接
		var server = net.createConnection(req.port,req.host);
		//交换服务器与浏览器的数据
		client.on("data", function(data){ server.write(data); });
		server.on("data", function(data){ client.write(data); });

		if (req.method == 'CONNECT')
			client.write(new Buffer("HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n"));
		else
			server.write(buffer);
	}

}).listen(srvport, srvip);
