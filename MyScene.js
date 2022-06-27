// 全局变量
var gl;				// WebGL上下文
var program; 		// shader program

var mvStack = [];  // 模视投影矩阵栈，用数组实现，初始为空***
var matCamera = mat4();	 // 照相机变换，初始为恒等矩阵
var matReverse = mat4(); // 照相机变换的逆变换，初始为恒等矩阵

var yRot = 0.0;        // 用于动画的旋转角
var deltaAngle = 60.0; // 每秒旋转角度

// 用于保存W、S、A、D四个方向键的按键状态的数组
var keyDown = [false, false, false, false];

var g = 9.8;				// 重力加速度
var initSpeed = 4; 			// 初始速度 
var jumping = false;	    // 是否处于跳跃过程中
var jumpY = 0;          	// 当前跳跃的高度
var jumpTime = 0;			// 从跳跃开始经历的时间

var ctx;
var isDayTime = true;		// 判断白天黑夜
var isHudShow = true;		// 判断Hud显示
var isFogOn = true;			// 判断雾化是否开启	

function passOnFog(){
	var fog;
	if(isFogOn)
		fog=1;
	else
		fog=0;
	gl.useProgram(program);
	gl.uniform1i(program.u_OnFog,fog);
	
	gl.useProgram(programObj);
	gl.uniform1i(programObj.u_OnFog,fog);
}

//===光照与材质=====================================*
var MaterialObj = function(){
	this.ambient = vec3(0.0,0.0,0.0);	//环境反射系数
	this.diffuse = vec3(0.8,0.8,0.8);	//漫反射系数
	this.specular = vec3(0.0,0.0,0.0);	//镜面反射系数
	this.emission = vec3(0.0,0.0,0.0);	//发射光
	this.shininess = 10;				//高光系数
	this.alpha = 1.0;					//透明度
}

//==================================================
var Light = function(){
	this.pos = vec4(1.0,1.0,1.0,0.0);
	this.ambient = vec3(0.2,0.2,0.2);
	this.diffuse = vec3(1.0,1.0,1.0);
	this.specular = vec3(1.0,1.0,1.0);
	this.on = true;	//是否开灯
}

var lights = [];			//光源数组***
var lightSun = new Light();	//默认光源***
var lightRed = new Light();	//红色位置光***
var lightBigSun = new Light();	//红色位置光***
var lightYellow = new Light();	//黄色手电筒***

function initLight(){
	lights.push(lightSun);
	
	//红光球
	lightRed.pos = vec4(0.0,0.0,0.0,1.0);
	lightRed.ambient = vec3(0.2,0.0,0.0);
	lightRed.diffuse = vec3(1.0,0.0,0.0);
	lightRed.specular = vec3(1.0,0.0,0.0);
	lights.push(lightRed);
	
	//手电筒
	lightYellow.pos = vec4(0.0,0.0,0.0,1.0);
	lightYellow.ambient = vec3(0.0,0.0,0.0);
	lightYellow.diffuse = vec3(1.0,1.0,0.0);
	lightYellow.specular = vec3(1.0,1.0,0.0);
	lights.push(lightYellow);
	
	//programOBJ光源==============================***
	gl.useProgram(programObj);
	var ambientLight = [];
	ambientLight.push(lightSun.ambient);
	ambientLight.push(lightRed.ambient);
	ambientLight.push(lightYellow.ambient);
	gl.uniform3fv(programObj.u_AmbientLight,flatten(ambientLight));
	var diffuseLight = [];
	diffuseLight.push(lightSun.diffuse);
	diffuseLight.push(lightRed.diffuse);
	diffuseLight.push(lightYellow.diffuse);
	gl.uniform3fv(programObj.u_DiffuseLight, flatten(diffuseLight));
	var specularLight = [];
	specularLight.push(lightSun.specular);
	specularLight.push(lightRed.specular);
	specularLight.push(lightYellow.specular);
	gl.uniform3fv(programObj.u_SpecularLight, flatten(specularLight));
	//给聚光灯传值
	gl.uniform3fv(programObj.u_SpotDirection,
		flatten(vec3(0.0,0.0,-1.0)));
	gl.uniform1f(programObj.u_SpotCutOff,8);
	gl.uniform1f(programObj.u_SpotExponent,3);
	//===============================================***
	
	//program光源==================================*
	gl.useProgram(program);
	//给聚光灯传值
	gl.uniform3fv(program.u_SpotDirection,
		flatten(vec3(0.0,0.0,-1.0)));
	gl.uniform1f(program.u_SpotCutOff,8);
	gl.uniform1f(program.u_SpotExponent,3);
	//=============================================*
	
	passLightsOn();
}
//==光源开关传值============================================
function passLightsOn(){
	var lightsOn = [];
	for (var i = 0; i< lights.length; i++){
		if(lights[i].on)
			lightsOn[i] = 1;
		else
			lightsOn[i] = 0;
	}
	gl.useProgram(program);
	gl.uniform1iv(program.u_LightOn, lightsOn);
	
	gl.useProgram(programObj);
	gl.uniform1iv(programObj.u_LightOn, lightsOn);
}
//==================================================
//光球默认材质
var mtlRedLight = new MaterialObj();
mtlRedLight.ambient = vec3(0.1,0.1,0.1);
mtlRedLight.diffuse = vec3(0.2,0.2,0.2);
mtlRedLight.specular = vec3(0.2,0.2,0.2);
mtlRedLight.emission = vec3(1.0,0.0,0.0);
mtlRedLight.shininess = 150;
//全局光照关闭时光球材质（半透明）
var mtlRedLightOff = new MaterialObj();
mtlRedLight.ambient = vec3(0.1,0.1,0.1);
mtlRedLight.diffuse = vec3(0.2,0.2,0.2);
mtlRedLight.specular = vec3(0.2,0.2,0.2);
mtlRedLight.emission = vec3(1.0,0.0,0.0);
mtlRedLight.shininess = 150;
mtlRedLight.alpha = 0.7;
//==================================================*


//===文理贴图=======================================**
var TextureObj = function(pathName, format, mipmapping){
	this.path = pathName;
	this.format = format;
	this.mipmapping = mipmapping;
	this.texture = null;
	this.complete = false;
}

function loadTexture(path, format, mipmapping){
	var texObj = new TextureObj(path, format, mipmapping);
	var image = new Image();
	if(!image){
		console.log("创建image对象失败");
		return false;
	}
	
	image.onload = function(){
		console.log("纹理图" + path + "加载完毕");
		initTexture(texObj, image);
		textureLoaded++;
		if(textureLoaded == numTextures)
			requestAnimFrame(render);
	}
	
	image.src = path;
	console.log("开始加载纹理图：" + path);
	
	return texObj;
}

function initTexture(texObj, image){
	texObj.texture = gl.createTexture(); // 创建纹理对象
	if(!texObj.texture){
		console.log("创建纹理对象失败");
		return false;
	}
	
	// 绑定当前二维纹理对象 
	gl.bindTexture(gl.TEXTURE_2D, texObj.texture);
	// 设置加载纹理图时沿Y轴翻转
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 
	// 加载纹理图到显存
	gl.texImage2D(gl.TEXTURE_2D, 0, 
		texObj.format, texObj.format, gl.UNSIGNED_BYTE, image);
		
	if(texObj.mipmapping){
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D,
		gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	}
	else
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	
	texObj.complete = true; // 纹理对象初始化完成
}
//==================================================**
function drawHud(){
	ctx.clearRect(0,0,800,1000);
	ctx.beginPath();
    ctx.moveTo(60, 20);
	ctx.lineTo(260, 20);
	ctx.lineTo(300, 100);
	ctx.lineTo(260, 180);
	ctx.lineTo(60, 180);
	ctx.lineTo(20, 100);
	ctx.closePath();
	ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
	ctx.stroke();
	
	ctx.font='22px "Times New Roman"';
	ctx.fillStyle='rgba(255,255,255,255)';
	ctx.fillText('陈景豪',125,50);
	ctx.font='18px "Times New Roman"';
	ctx.fillText('2019030002086',100,90);
	ctx.fillText('选作内容：旋转太阳 Hud(4)',55,130);
	ctx.fillText('黑白切换(5) 雾气(6)',85,170);
}
//==================================================

// 定义Obj对象
// 构造函数
var Obj = function(){
	this.numVertices = 0; 			// 顶点个数
	this.vertices = new Array(0); 	// 用于保存顶点数据的数组
	this.normals = new Array(0); 	// 用于保存法向数据的数组*
	this.texcoords = new Array(0);	// 用于保存纹理坐标的数组**
	this.vertexBuffer = null;		// 存放顶点数据的buffer对象
	this.normalBuffer = null;		// 存放法向数据的buffer对象*
	this.texBuffer = null;			// 存放纹理坐标数据的buffer对象**
	this.material = new MaterialObj();	// 材质*
	this.texObj = null;				// texture对象**
}

// 初始化缓冲区对象(VBO)
Obj.prototype.initBuffers = function(){
	/*创建并初始化顶点坐标缓冲区对象(Buffer Object)*/
	// 创建缓冲区对象，存于成员变量vertexBuffer中
	this.vertexBuffer = gl.createBuffer(); 
	// 将vertexBuffer绑定为当前Array Buffer对象
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为Buffer对象在GPU端申请空间，并提供数据
	gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
		flatten(this.vertices),		// 数据来源
		gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
		);
	// 顶点数据已传至GPU端，可释放内存
	this.vertices.length = 0; 
	
	//==创建并初始化定点法向缓冲区对象=====================
	if(this.normals.length != 0){
		this.normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
			flatten(this.normals),		// 数据来源
			gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
			);
		this.normals.length = 0;
	}
	//=====================================================
	
	//==创建并初始化定点纹理缓冲区对象=====================
	if(this.texcoords.length != 0){
		this.texBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
			flatten(this.texcoords),		// 数据来源
			gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
			);
		this.texcoords.length = 0;
	}
	//=====================================================
}

// 绘制几何对象
// 参数为模视矩阵
Obj.prototype.draw = function(matMV, material, tmpTexObj){
	// 设置为a_Position提供数据的方式
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为顶点属性数组提供数据(数据存放在vertexBuffer对象中)
	gl.vertexAttribPointer( 
		program.a_Position,	// 属性变量索引
		3,					// 每个顶点属性的分量个数
		gl.FLOAT,			// 数组数据类型
		false,				// 是否进行归一化处理
		0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
		0    // 第一个属性值在buffer中的偏移量
		);
	// 为a_Position启用顶点数组
	gl.enableVertexAttribArray(program.a_Position);	
	
	//************************************************************
	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.vertexAttribPointer( 
		program.a_Normal,	// 属性变量索引
		3,					// 每个顶点属性的分量个数
		gl.FLOAT,			// 数组数据类型
		false,				// 是否进行归一化处理
		0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
		0    // 第一个属性值在buffer中的偏移量
		);
	// 为a_Position启用顶点数组
	gl.enableVertexAttribArray(program.a_Normal);	
	//************************************************************
	
	//************************************************************
	if(this.texBuffer != null){
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		gl.vertexAttribPointer( 
			program.a_Texcoord,	// 属性变量索引
			2,					// 每个顶点属性的分量个数
			gl.FLOAT,			// 数组数据类型
			false,				// 是否进行归一化处理
			0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
			0    // 第一个属性值在buffer中的偏移量
			);
		// 为a_Position启用顶点数组
		gl.enableVertexAttribArray(program.a_Texcoord);	
	}
	//************************************************************
	
	
	var mtl;
	if(arguments.length > 1 && arguments[1]!=null)
		mtl = material;
	else
		mtl = this.material;

	//===设置材质属性=================================*
	var ambientProducts = [];
	var diffuseProducts = [];
	var specularProducts = [];
	for(var i = 0; i < lights.length; i++)
	{
		ambientProducts.push(mult(lights[i].ambient,
			mtl.ambient));
		diffuseProducts.push(mult(lights[i].diffuse,
			mtl.diffuse));
		specularProducts.push(mult(lights[i].specular,
			mtl.specular));
	}
	
	gl.uniform3fv(program.u_AmbientProduct,
		flatten(ambientProducts));
		
	gl.uniform3fv(program.u_DiffuseProduct,
		flatten(diffuseProducts));
		
	gl.uniform3fv(program.u_SpecularProduct,
		flatten(specularProducts));
	
	gl.uniform3fv(program.u_Emission,
		flatten(mtl.emission));
		
	gl.uniform1f(program.u_Shininess,mtl.shininess);
	gl.uniform1f(program.u_Alpha, mtl.alpha);
	
	//================================================*
	
	//纹理**
	var texObj;
	if(arguments.length>2 && arguments[2]!=null)
		texObj = tmpTexObj;
	else
		texObj = this.texObj;
	
	if(texObj != null && texObj.complete)
		gl.bindTexture(gl.TEXTURE_2D, texObj.texture);
	
	// 开始绘制
	gl.uniformMatrix4fv(program.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵***
	gl.uniformMatrix3fv(program.u_NormalMat, false, 
		flatten(normalMatrix(matMV)));	// 传法向矩阵***
	gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
}

// 在y=0平面绘制中心在原点的格状方形地面
// fExtent：决定地面区域大小(方形地面边长的一半)
// fStep：决定线之间的间隔
// 返回地面Obj对象
function buildGround(fExtent, fStep){	
	var obj = new Obj(); // 新建一个Obj对象
	var iterations = 2 * fExtent / fStep;
	var fTexcoordStep = 40 / iterations;

	for(var x = -fExtent, s = 0; x < fExtent; x += fStep, s += fTexcoordStep){
		for(var z = fExtent, t = 0; z > -fExtent; z -= fStep, t+=fTexcoordStep){
			// 以(x, 0, z)为左下角的单元四边形的4个顶点
			var ptLowerLeft = vec3(x, 0, z);
			var ptLowerRight = vec3(x + fStep, 0, z);
			var ptUpperLeft = vec3(x, 0, z - fStep);
			var ptUpperRight = vec3(x + fStep, 0, z - fStep);
			
			// 分成2个三角形
			obj.vertices.push(ptUpperLeft);    
			obj.vertices.push(ptLowerLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperRight);
			
			// 定点法向===========================
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			//====================================
			
			// 纹理坐标===========================
			obj.texcoords.push(vec2(s, t + fTexcoordStep));
			obj.texcoords.push(vec2(s, t));
			obj.texcoords.push(vec2(s + fTexcoordStep, t));
			obj.texcoords.push(vec2(s, t + fTexcoordStep));
			obj.texcoords.push(vec2(s + fTexcoordStep, t));
			obj.texcoords.push(vec2(s + fTexcoordStep, t + fTexcoordStep));
			//====================================
			
			
			obj.numVertices += 6;
		}
	}
	//材质
	obj.material.ambient = vec3(0.1,0.1,0.1);
	obj.material.diffuse = vec3(0.8,0.8,0.8);
	obj.material.specular = vec3(0.3,0.3,0.3);
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 10;
	
	return obj;
}

// 用于生成一个中心在原点的球的顶点数据(南北极在z轴方向)
// 返回球Obj对象，参数为球的半径及经线和纬线数
function buildSphere(radius, columns, rows){
	var obj = new Obj(); // 新建一个Obj对象
	var vertices = []; // 存放不同顶点的数组

	for (var r = 0; r <= rows; r++){
		var v = r / rows;  // v在[0,1]区间
		var theta1 = v * Math.PI; // theta1在[0,PI]区间

		var temp = vec3(0, 0, 1);
		var n = vec3(temp); // 实现Float32Array深拷贝
		var cosTheta1 = Math.cos(theta1);
		var sinTheta1 = Math.sin(theta1);
		n[0] = temp[0] * cosTheta1 + temp[2] * sinTheta1;
		n[2] = -temp[0] * sinTheta1 + temp[2] * cosTheta1;
		
		for (var c = 0; c <= columns; c++){
			var u = c / columns; // u在[0,1]区间
			var theta2 = u * Math.PI * 2; // theta2在[0,2PI]区间
			var pos = vec3(n);
			temp = vec3(n);
			var cosTheta2 = Math.cos(theta2);
			var sinTheta2 = Math.sin(theta2);
			
			pos[0] = temp[0] * cosTheta2 - temp[1] * sinTheta2;
			pos[1] = temp[0] * sinTheta2 + temp[1] * cosTheta2;
			
			var posFull = mult(pos, radius);
			
			vertices.push(posFull);
		}
	}

	/*生成最终顶点数组数据(使用三角形进行绘制)*/
	var colLength = columns + 1;
	for (var r = 0; r < rows; r++){
		var offset = r * colLength;

		for (var c = 0; c < columns; c++){
			var ul = offset  +  c;						// 左上
			var ur = offset  +  c + 1;					// 右上
			var br = offset  +  (c + 1 + colLength);	// 右下
			var bl = offset  +  (c + 0 + colLength);	// 左下

			// 由两条经线和纬线围成的矩形
			// 分2个三角形来画
			obj.vertices.push(vertices[ul]); 
			obj.vertices.push(vertices[bl]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ul]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ur]);
			
			//===球的法向=======================
			obj.normals.push(vertices[ul]); 
			obj.normals.push(vertices[bl]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ul]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ur]);
			//==================================
			
			//===纹理坐标=======================
			obj.texcoords.push(vec2(c/columns, r/rows));
			obj.texcoords.push(vec2(c/columns, (r+1)/rows));
			obj.texcoords.push(vec2((c+1)/columns, (r+1)/rows));
			obj.texcoords.push(vec2(c/columns, r/rows));
			obj.texcoords.push(vec2((c+1)/columns, (r+1)/rows));
			obj.texcoords.push(vec2((c+1)/columns, r/rows));
			//==================================
		}
	}

	vertices.length = 0; // 已用不到，释放 
	obj.numVertices = rows * columns * 6; // 顶点数
	
	//材质
	obj.material.ambient = vec3(1.0,0.0,1.0);
	obj.material.diffuse = vec3(0.6,0.6,0.6);
	obj.material.specular = vec3(0.3,0.3,0.3);
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 20;
	return obj;
}

// 构建中心在原点的圆环(由线段构建)
// 参数分别为圆环的主半径(决定环的大小)，
// 圆环截面圆的半径(决定环的粗细)，
// numMajor和numMinor决定模型精细程度
// 返回圆环Obj对象
function buildTorus(majorRadius, minorRadius, numMajor, numMinor){
	var obj = new Obj(); // 新建一个Obj对象
	
	obj.numVertices = numMajor * numMinor * 6; // 顶点数

	var majorStep = 2.0 * Math.PI / numMajor;
	var minorStep = 2.0 * Math.PI / numMinor;
	var sScale = 4, tScale = 2;

	for(var i = 0; i < numMajor; ++i){
		var a0 = i * majorStep;
		var a1 = a0 + majorStep;
		var x0 = Math.cos(a0);
		var y0 = Math.sin(a0);
		var x1 = Math.cos(a1);
		var y1 = Math.sin(a1);
		
		// 三角形条带左右定点对应的两个圆环中心***
		var center0 = mult(majorRadius, vec3(x0,y0,0));
		var center1 = mult(majorRadius, vec3(x1,y1,0));
		
		for(var j = 0; j < numMinor; ++j){
			var b0 = j * minorStep;
			var b1 = b0 + minorStep;
			var c0 = Math.cos(b0);
			var r0 = minorRadius * c0 + majorRadius;
			var z0 = minorRadius * Math.sin(b0);
			var c1 = Math.cos(b1);
			var r1 = minorRadius * c1 + majorRadius;
			var z1 = minorRadius * Math.sin(b1);

			var left0 = vec3(x0*r0, y0*r0, z0);
			var right0 = vec3(x1*r0, y1*r0, z0);
			var left1 = vec3(x0*r1, y0*r1, z1);
			var right1 = vec3(x1*r1, y1*r1, z1);
			obj.vertices.push(left0);  
			obj.vertices.push(right0); 
			obj.vertices.push(left1); 
			obj.vertices.push(left1); 
			obj.vertices.push(right0);
			obj.vertices.push(right1);
			
			// 法向从圆环中心指向定点====================
			obj.normals.push(subtract(left0, center0));
			obj.normals.push(subtract(right0, center1));
			obj.normals.push(subtract(left1, center0));
			obj.normals.push(subtract(left1, center0));
			obj.normals.push(subtract(right0, center1));
			obj.normals.push(subtract(right1, center1));
			//===========================================
			
			// 纹理坐标==================================
			obj.texcoords.push(vec2(i / numMajor * sScale,
				j / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale,
				j / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale,
				(j+1) / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale,
				(j+1) / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale,
				j / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale,
				(j+1) / numMinor * tScale));
			//===========================================
		}
	}
	//材质
	obj.material.ambient = vec3(0.0,1.0,1.0);
	obj.material.diffuse = vec3(0.6,0.6,0.6);
	obj.material.specular = vec3(0.3,0.3,0.3);
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 20;
	return obj;
}

// 获取shader中变量位置
function getLocation(){
	/*获取shader中attribute变量的位置(索引)*/
    program.a_Position = gl.getAttribLocation(program, "a_Position");
	if(program.a_Position < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Position失败！"); 
	}
	program.a_Normal = gl.getAttribLocation(program, "a_Normal");
	if(program.a_Normal < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Normal失败！"); 
	}
	program.a_Texcoord = gl.getAttribLocation(program, "a_Texcoord");
	if(program.a_Texcoord < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Texcoord失败！"); 
	}
	
	/*获取shader中uniform变量的位置(索引)*/
	program.u_ModelView = gl.getUniformLocation(program, "u_ModelView");
	if(!program.u_ModelView){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_ModelView失败！"); 
	}	
	program.u_Projection = gl.getUniformLocation(program, "u_Projection");
	if(!program.u_Projection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Projection失败！"); 
	}	
	program.u_NormalMat = gl.getUniformLocation(program, "u_NormalMat");
	if(!program.u_NormalMat){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_NormalMat失败！"); 
	}	
	program.u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
	if(!program.u_LightPosition){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightPosition失败！"); 
	}	
	program.u_AmbientProduct = gl.getUniformLocation(program, "u_AmbientProduct");
	if(!program.u_AmbientProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_AmbientProduct失败！"); 
	}	
	program.u_DiffuseProduct = gl.getUniformLocation(program, "u_DiffuseProduct");
	if(!program.u_DiffuseProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_DiffuseProduct失败！"); 
	}	
	program.u_SpecularProduct = gl.getUniformLocation(program, "u_SpecularProduct");
	if(!program.u_SpecularProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpecularProduct失败！"); 
	}	
	program.u_Shininess = gl.getUniformLocation(program, "u_Shininess");
	if(!program.u_Shininess){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Shininess失败！"); 
	}	
	program.u_Emission = gl.getUniformLocation(program, "u_Emission");
	if(!program.u_Emission){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Emission失败！"); 
	}	
	program.u_SpotDirection = gl.getUniformLocation(program, "u_SpotDirection");
	if(!program.u_SpotDirection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotDirection失败！"); 
	}	
	program.u_SpotCutOff = gl.getUniformLocation(program, "u_SpotCutOff");
	if(!program.u_SpotCutOff){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotCutOff失败！"); 
	}	
	program.u_SpotExponent = gl.getUniformLocation(program, "u_SpotExponent");
	if(!program.u_SpotExponent){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotExponent失败！"); 
	}	
	program.u_LightOn = gl.getUniformLocation(program, "u_LightOn");
	if(!program.u_LightOn){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightOn失败！"); 
	}	
	program.u_Sampler = gl.getUniformLocation(program, "u_Sampler");
	if(!program.u_Sampler){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Sampler失败！"); 
	}
	program.u_Alpha = gl.getUniformLocation(program, "u_Alpha");
	if(!program.u_Alpha){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Alpha失败！"); 
	}
	program.u_bOnlyTexture = gl.getUniformLocation(program, "u_bOnlyTexture");
	if(!program.u_bOnlyTexture){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_bOnlyTexture失败！"); 
	}
	program.u_OnFog = gl.getUniformLocation(program, "u_OnFog");
	if(!program.u_OnFog){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_OnFog失败！"); 
	}	
	program.u_FogColor = gl.getUniformLocation(program, "u_FogColor");
	if(!program.u_FogColor){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_FogColor失败！"); 
	}	
	program.u_FogDist = gl.getUniformLocation(program, "u_FogDist");
	if(!program.u_FogDist){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_FogDist失败！"); 
	}	
	//======================================================================
	attribIndex.a_Position = gl.getAttribLocation(programObj, "a_Position");
	if(attribIndex.a_Position < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Position失败！"); 
	}
	attribIndex.a_Normal = gl.getAttribLocation(programObj, "a_Normal");
	if(attribIndex.a_Normal < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Normal失败！"); 
	}
	attribIndex.a_Texcoord = gl.getAttribLocation(programObj, "a_Texcoord");
	if(attribIndex.a_Texcoord < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Texcoord失败！"); 
	}
	
	/*获取shader中uniform变量的位置(索引)*/
	mtlIndex.u_Ka = gl.getUniformLocation(programObj, "u_Ka");
	if(!mtlIndex.u_Ka){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ka失败！"); 
	}

	mtlIndex.u_Kd = gl.getUniformLocation(programObj, "u_Kd");
	if(!mtlIndex.u_Kd){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Kd失败！"); 
	}

	mtlIndex.u_Ks = gl.getUniformLocation(programObj, "u_Ks");
	if(!mtlIndex.u_Ks){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ks失败！"); 
	}
	mtlIndex.u_Ke = gl.getUniformLocation(programObj, "u_Ke");
	if(!mtlIndex.u_Ke){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ke失败！"); 
	}
	mtlIndex.u_Ns = gl.getUniformLocation(programObj, "u_Ns");
	if(!mtlIndex.u_Ns){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ns失败！"); 
	}
	mtlIndex.u_d = gl.getUniformLocation(programObj, "u_d");
	if(!mtlIndex.u_d){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_d失败！"); 
	}
	programObj.u_ModelView = gl.getUniformLocation(programObj, "u_ModelView");
	if(!programObj.u_ModelView){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_ModelView失败！"); 
	}	
	programObj.u_Projection = gl.getUniformLocation(programObj, "u_Projection");
	if(!programObj.u_Projection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Projection失败！"); 
	}	
	programObj.u_NormalMat = gl.getUniformLocation(programObj, "u_NormalMat");
	if(!programObj.u_NormalMat){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_NormalMat失败！"); 
	}	
	programObj.u_LightPosition = gl.getUniformLocation(programObj, "u_LightPosition");
	if(!programObj.u_LightPosition){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightPosition失败！"); 
	}	
	programObj.u_AmbientLight = gl.getUniformLocation(programObj, "u_AmbientLight");
	if(!programObj.u_AmbientLight){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_AmbientLight失败！"); 
	}	
	programObj.u_DiffuseLight = gl.getUniformLocation(programObj, "u_DiffuseLight");
	if(!programObj.u_DiffuseLight){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_DiffuseLight失败！"); 
	}	
	programObj.u_SpecularLight = gl.getUniformLocation(programObj, "u_SpecularLight");
	if(!programObj.u_SpecularLight){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpecularLight失败！"); 
	}	
	programObj.u_SpotDirection = gl.getUniformLocation(programObj, "u_SpotDirection");
	if(!programObj.u_SpotDirection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotDirection失败！"); 
	}	
	programObj.u_SpotCutOff = gl.getUniformLocation(programObj, "u_SpotCutOff");
	if(!programObj.u_SpotCutOff){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotCutOff失败！"); 
	}	
	programObj.u_SpotExponent = gl.getUniformLocation(programObj, "u_SpotExponent");
	if(!programObj.u_SpotExponent){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotExponent失败！"); 
	}	
	programObj.u_LightOn = gl.getUniformLocation(programObj, "u_LightOn");
	if(!programObj.u_LightOn){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightOn失败！"); 
	}	
	programObj.u_Sampler = gl.getUniformLocation(programObj, "u_Sampler");
	if(!programObj.u_Sampler){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Sampler失败！"); 
	}
	program.u_OnFog = gl.getUniformLocation(program, "u_OnFog");
	if(!program.u_OnFog){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_OnFog失败！"); 
	}	
	program.u_FogColor = gl.getUniformLocation(program, "u_FogColor");
	if(!program.u_FogColor){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_FogColor失败！"); 
	}	
	program.u_FogDist = gl.getUniformLocation(program, "u_FogDist");
	if(!program.u_FogDist){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_FogDist失败！"); 
	}

}

var ground = buildGround(20.0, 0.1); // 生成地面对象

var numSpheres = 50;  // 场景中球的数目
// 用于保存球位置的数组，对每个球位置保存其x、z坐标
var posSphere = [];  
var sphere = buildSphere(0.2, 15, 15); // 生成球对象

var torus = buildTorus(0.35, 0.15, 40, 20); // 生成圆环对象

var lightTexObj;	//光球纹理**
var skyTexObj;		//天空球**
var nightTexObj;	//夜晚天空球****

var textureLoaded = 0;
var numTextures = 5;


//开始读取obj***
var obj = loadOBJ("Res\\Saber.obj");
//开始读取obj1***
var obj1 = loadOBJ("Res\\Xkl\\Charmander.obj");
var programObj;	// obj模型绘制所使用的program
var attribIndex = new AttribIndex();  // programObj中attribute变量索引
var mtlIndex = new MTLIndex();		  // programObj中材质变量索引







// 初始化场景中的几何对象
function initObjs(){
	// 初始化地面顶点数据缓冲区对象(VBO)
	ground.initBuffers(); 
	// 初始化地面纹理
	ground.texObj = loadTexture("Res\\ground.bmp", gl.RGB, true);
	
	var sizeGround = 20;
	// 随机放置球的位置
	for(var iSphere = 0; iSphere < numSpheres; iSphere++){
		// 在 -sizeGround 和 sizeGround 间随机选择一位置
		var x = Math.random() * sizeGround * 2 - sizeGround;
		var z = Math.random() * sizeGround * 2 - sizeGround;
		posSphere.push(vec2(x, z));
	}
	
	// 初始化球顶点数据缓冲区对象(VBO)
	sphere.initBuffers();
	// 初始化球纹理
	sphere.texObj = loadTexture("Res\\sphere.jpg", gl.RGB, true);
	
	// 初始化圆环顶点数据缓冲区对象(VBO)
	torus.initBuffers();
	// 初始化圆环纹理
	torus.texObj = loadTexture("Res\\torus.jpg", gl.RGB, true);
	
	// 初始化旋转光球纹理
	lightTexObj = loadTexture("Res\\sun.bmp", gl.RGB, true);
	// 初始化天空盒纹理
	skyTexObj = loadTexture("Res\\sky.jpg", gl.RGB, true);
	// 初始化夜晚天空盒纹理
	nightTexObj = loadTexture("Res\\stars.bmp", gl.RGB, true);
}


// 页面加载完成后会调用此函数，函数名可任意(不一定为main)
window.onload = function main(){
	// 获取页面中id为webgl的canvas元素
    var canvas = document.getElementById("webgl");
	if(!canvas){ // 获取失败？
		alert("获取canvas元素失败！"); 
		return;
	}
	
	// 利用辅助程序文件中的功能获取WebGL上下文
	// 成功则后面可通过gl来调用WebGL的函数
    gl = WebGLUtils.setupWebGL(canvas,{alpha:false});    
    if (!gl){ // 失败则弹出信息
		alert("获取WebGL上下文失败！"); 
		return;
	}        
	
	var hud = document.getElementById("hud");
	if(!hud){ // 获取失败？
		alert("获取hud元素失败！"); 
		return;
	}

	/*设置WebGL相关属性*/
    gl.clearColor(0.0, 0.0, 0.5, 1.0); // 设置背景色为蓝色
	gl.enable(gl.DEPTH_TEST);	// 开启深度检测
	gl.enable(gl.CULL_FACE);	// 开启面剔除
	// 设置视口，占满整个canvas
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	
	/*加载shader程序并为shader中attribute变量提供数据*/
	// 加载id分别为"vertex-shader"和"fragment-shader"的shader程序，
	// 并进行编译和链接，返回shader程序对象program
    program = initShaders(gl, "vertex-shader", 
		"fragment-shader");
		
	//===新的program***==========
	programObj = initShaders(gl, "vertex-shader", 
		"fragment-shaderNew");
	//===========================
    gl.useProgram(program);	// 启用该shader程序对象 
	
	// 获取shader中变量位置
	getLocation();	
	ctx=hud.getContext('2d');
	
	//雾化===============================================
	var fogColor=new Float32Array([0.137,0.231,0.423]);
	var fogDist=new Float32Array([4,8]);
	//===================================================
	
	
	// 设置投影矩阵：透视投影，根据视口宽高比指定视域体
	matProj = perspective(35.0, 		// 垂直方向视角
		canvas.width / canvas.height, 	// 视域体宽高比
		0.1, 							// 相机到近裁剪面距离
		100.0);							// 相机到远裁剪面距离
		
	gl.uniformMatrix4fv(program.u_Projection, false, flatten(matProj))
	
	gl.uniform1i(program.u_Sampler,0);//**
	
	//雾化===============================================
	gl.uniform3fv(program.u_FogColor,fogColor);
	gl.uniform2fv(program.u_FogDist,fogDist);
	//===================================================	
	
	gl.useProgram(programObj);
		//雾化===============================================
	gl.uniform3fv(programObj.u_FogColor,fogColor);
	gl.uniform2fv(programObj.u_FogDist,fogDist);
	//===================================================
	gl.uniformMatrix4fv(programObj.u_Projection, false, flatten(matProj)); 
	
	
	// 初始化场景中的几何对象
	initObjs();
	initLight();
	passOnFog();
	// 进行绘制
    //render();
};

// 按键响应
window.onkeydown = function(){
	switch(event.keyCode){
		case 38:	// Up
			matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
			matCamera = mult(translate(0.0, 0.0, 0.1), matCamera);
			break;
		case 40:	// Down
			matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
			matCamera = mult(translate(0.0, 0.0, -0.1), matCamera);
			break;
		case 37:	// Left
			matReverse = mult(matReverse, rotateY(1));
			matCamera = mult(rotateY(-1), matCamera);
			break;
		case 39:	// Right
			matReverse = mult(matReverse, rotateY(-1));
			matCamera = mult(rotateY(1), matCamera);
			break;
		case 87:	// W
			keyDown[0] = true;
			break;
		case 83:	// S
			keyDown[1] = true;
			break;
		case 65:	// A
			keyDown[2] = true;
			break;
		case 68:	// D
			keyDown[3] = true;
			break;
		case 32: 	// space
			if(!jumping){
				jumping = true;
				jumpTime = 0;
			}
			break;
		case 49:	// 1
			lights[0].on = !lights[0].on;
			passLightsOn();
			break;
		case 50:	// 2
			lights[1].on = !lights[1].on;
			passLightsOn();
			break;
		case 51:	// 3
			lights[2].on = !lights[2].on;
			passLightsOn();
			break;
		case 53:	// 5
			isDayTime = !isDayTime;
			break;
		case 52:	// 4
			isHudShow = !isHudShow;
			break;
		case 54:	// 6
			isFogOn = !isFogOn;
			passOnFog();
			break;
	}
	// 禁止默认处理(例如上下方向键对滚动条的控制)
	event.preventDefault(); 
	//console.log("%f, %f, %f", matReverse[3], matReverse[7], matReverse[11]);
}

// 按键弹起响应
window.onkeyup = function(){
	switch(event.keyCode){
		case 87:	// W
			keyDown[0] = false;
			break;
		case 83:	// S
			keyDown[1] = false;
			break;
		case 65:	// A
			keyDown[2] = false;
			break;
		case 68:	// D
			keyDown[3] = false;
			break;
	}
}

// 记录上一次调用函数的时刻
var last = Date.now();

// 根据时间更新旋转角度
function animation(){
	// 计算距离上次调用经过多长的时间
	var now = Date.now();
	var elapsed = (now - last) / 1000.0; // 秒
	last = now;
	
	// 更新动画状态
	yRot += deltaAngle * elapsed;

	// 防止溢出
    yRot %= 360;
	
	// 跳跃处理
	jumpTime += elapsed;
	if(jumping){
		jumpY = initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
		if(jumpY <= 0){
			jumpY = 0;
			jumping = false;
		}
	}
}

// 更新照相机变换
function updateCamera(){
	// 照相机前进
	if(keyDown[0]){
		matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
		matCamera = mult(translate(0.0, 0.0, 0.1), matCamera);
	}
	
	// 照相机后退
	if(keyDown[1]){
		matReverse = mult(matReverse, translate(0.0, 0.0, 0.1));
		matCamera = mult(translate(0.0, 0.0, -0.1), matCamera);
	}
	
	// 照相机左转
	if(keyDown[2]){
		matReverse = mult(matReverse, rotateY(1));
		matCamera = mult(rotateY(-1), matCamera);
	}
	
	// 照相机右转
	if(keyDown[3]){
		matReverse = mult(matReverse, rotateY(-1));
		matCamera = mult(rotateY(1), matCamera);
	}
}

// 绘制函数
function render() {
	//就绪检查***
	if(!obj.isAllReady(gl) || !obj1.isAllReady(gl)){
		requestAnimFrame(render);
		return;
	}

	animation(); // 更新动画参数
	
	updateCamera(); // 更新相机变换
	
	// 清颜色缓存和深度缓存
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   
    // 模视投影矩阵初始化为投影矩阵*照相机变换矩阵
	var matMV = mult(translate(0, -jumpY, 0), matCamera);	

	//*************************************************************
	var lightPositions = [];
	var matRotatingSphere = mult(matMV, mult(translate(0.0,0.0,-2.5),
		mult(rotateY(-yRot * 2.0), translate(1.0,0.0,0.0))));
	lightPositions.push(mult(matMV,lightSun.pos));
	lightPositions.push(mult(matRotatingSphere, lightRed.pos));
	lightPositions.push(lightYellow.pos);
	
	// 传观察坐标系下光源位置/方向
	gl.useProgram(program);
	gl.uniform4fv(program.u_LightPosition, 
		flatten(lightPositions));
	gl.useProgram(programObj);
	gl.uniform4fv(programObj.u_LightPosition, 
		flatten(lightPositions));
		
	//=================***
	/*绘制Obj模型*/
	gl.useProgram(programObj);
	mvStack.push(matMV); 
	matMV = mult(matMV, translate(0.0, 0.0, -1.0));
	matMV = mult(matMV, rotateY(-yRot * 3.0));
	matMV = mult(matMV, scale(0.1, 0.1, 0.1));
	gl.uniformMatrix4fv(programObj.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(programObj.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	obj.draw(gl, attribIndex, mtlIndex, programObj.u_Sampler);
	matMV = mvStack.pop();
	//=================***
	//=================***
	/*绘制Obj2模型*/
	//gl.useProgram(programObj);
	mvStack.push(matMV); 
	matMV = mult(matMV, translate(0.5, -0.40,-1.0));
	matMV = mult(matMV, rotateY(-yRot * 3.0));
	matMV = mult(matMV, scale(0.05, 0.05, 0.05));
	gl.uniformMatrix4fv(programObj.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(programObj.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	obj1.draw(gl, attribIndex, mtlIndex, programObj.u_Sampler);
	matMV = mvStack.pop();
	//=================***
	//*************************************************************
	
	
	gl.useProgram(program);
	/*绘制天空球*/
	gl.disable(gl.CULL_FACE);
	mvStack.push(matMV);
	matMV = mult(matMV, scale(150.0,150.0,150.0));
	matMV = mult(matMV, rotateX(90));
	gl.uniform1i(program.u_bOnlyTexture,1);
	if(isDayTime == true){
		sphere.draw(matMV,null,skyTexObj);
	}
	else{
		sphere.draw(matMV,null,nightTexObj);
	}
	gl.uniform1i(program.u_bOnlyTexture,0);
	matMV = mvStack.pop();
	gl.enable(gl.CULL_FACE);

	
	/*绘制地面*/
	mvStack.push(matMV);
	// 将地面移到y=-0.4平面上
	matMV = mult(matMV, translate(0.0, -0.4, 0.0));
	ground.draw(matMV);
	matMV = mvStack.pop();

	/*绘制每个球体*/
	for(var i = 0; i < numSpheres; i++){
		mvStack.push(matMV);
		matMV = mult(matMV, translate(posSphere[i][0],
			-0.2, posSphere[i][1])); // 平移到相应位置
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		sphere.draw(matMV);
		matMV = mvStack.pop();
	}
	
	// 将后面的模型往-z轴方向移动
	// 使得它们位于摄像机前方(也即世界坐标系原点前方)
	matMV = mult(matMV, translate(0.0, 0.0, -2.5));

	
	/*绘制自转的圆环*/
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 0.1, 0.0));
	matMV = mult(matMV, rotateY(yRot));
	torus.draw(matMV);
	matMV = mvStack.pop();
	
	/*绘制绕原点旋转的球*/
	mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
		// 调整南北极后先旋转再平移
		matMV = mult(matMV, rotateY(-yRot * 2.0));
		matMV = mult(matMV, translate(1.0, 0.0, 0.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		//***
		if(lights[1].on)
			sphere.draw(matMV, mtlRedLight, lightTexObj);
		else
			sphere.draw(matMV, mtlRedLightOff, lightTexObj);
		//***
	matMV = mvStack.pop();
	
	/*绘制绕原点旋转的太阳*/
	mvStack.push(matMV); 
	matMV = mult(matMV, rotateZ(yRot * 1.0));
		matMV = mult(matMV, translate(0.0, 8.0, -15.0));
		matMV = mult(matMV, scale(5.0,5.0,5.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		sphere.draw(matMV, mtlRedLightOff, lightTexObj);
	matMV = mvStack.pop();
	if(isHudShow == true){
		drawHud();
	}
	else {
		ctx.clearRect(0,0,800,600);
	}

	requestAnimFrame(render); // 请求重绘
}