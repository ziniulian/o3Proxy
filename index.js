// HTTP/HTTPS 间接代理

// LZR 模块加载
require("lzr");

// LZR 子模块加载
LZR.load([
	"LZR.Node.Srv.O3clientPoxSrv"
]);

var srv = new LZR.Node.Srv.O3clientPoxSrv ({
	// srvHost: "127.0.0.1",
	srvHost: "srv-lzrwebp.a3c1.starter-us-west-1.openshiftapps.com",
	// showLog: true,
	srvHttp: "POST /ptth",
	srvHttps: "POST /ptths/"
});

srv.start(
	process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
	process.env.OPENSHIFT_NODEJS_PORT || 8081
);
