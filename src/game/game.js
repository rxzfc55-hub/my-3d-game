import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

(function(){

"use strict";


/* =========================================================
   ERROR SAFETY
========================================================= */

window.addEventListener(
    "error",
    function(e){

        console.error(
            "GAME ERROR:",
            e.message,
            e.filename,
            e.lineno
        );

    }
);


/* =========================================================
   THREE CHECK
========================================================= */

if(
    typeof THREE === "undefined"
){

    document.getElementById(
        "loadingTitle"
    ).textContent=
        "لم يتم تحميل Three.js";

    document.getElementById(
        "loadingPercent"
    ).textContent=
        "تأكد من اتصال الإنترنت داخل Acode";

    return;
}


/* =========================================================
   CONFIG
========================================================= */

const CONFIG={

    /* مدينة محدودة: 3160م × 3160م ≈ 10 كم² */

    CITY_HALF:1580,

    GRID_STEP:316,

    WORLD_START:-1580,

    WORLD_END:1580,

    BRANCH_DISTANCE:100,

    BRANCH_LENGTH:260,

    /*
       بعد عكس الأزرار:
       زر "أمام" يستخدم مسار backward  -> MAX_REVERSE
       زر "خلف"  يستخدم مسار forward   -> MAX_SPEED
    */

    MAX_SPEED:50,

    MAX_REVERSE:150,

    ACCELERATION:34,

    BRAKE:55,

    FRICTION:7,

    STEERING:2.25,

    /*
       رُفعت هذه الأسقف لأن شبكة شوارع
       المدينة الآن أطول بكثير من الممر
       الواحد السابق (~66 كم من الشوارع).
    */

    MAX_TREES:420,

    MAX_BUILDINGS:260,

    /* سقف مستقل لمنازل الشوارع الفرعية (كل 150م) — مرتفع كفاية ليغطي كل الشوارع الفرعية لا أولها فقط */
    MAX_SIDE_HOUSES:550,

    /* سقف مستقل لمنازل الجادات الرئيسية (كل 150م على الجانبين) — كافٍ لتغطية كل الجادات لا أولها فقط */
    MAX_AVENUE_HOUSES:400,

    MAX_PEOPLE:90,

    /*
       مسافة اعتبار الشخص قريباً
       من حادث الدهس.
    */

    PANIC_RADIUS:32,

    /*
       سرعة الهروب.
    */

    PANIC_SPEED_MIN:2.2,

    PANIC_SPEED_MAX:4.8,

    /*
       مدة هروب الشخص.
    */

    PANIC_TIME_MIN:4,

    PANIC_TIME_MAX:9,

    /*
       المسافة اللازمة لالتقاط الراكب.
    */

    PICKUP_DISTANCE:5.5,

    /*
       مسافة التسليم.
    */

    DELIVERY_DISTANCE:9

};


/* =========================================================
   SCENE
========================================================= */

const scene=
    new THREE.Scene();

scene.background=
    new THREE.Color(
        0xb9deef
    );

scene.fog=
    new THREE.Fog(
        0xb9deef,
        120,
        650
    );


/* =========================================================
   CAMERA
========================================================= */

const camera=
    new THREE.PerspectiveCamera(

        72,

        window.innerWidth/
        window.innerHeight,

        .1,

        /*
           كانت 700 فقط — أقصر من نصف قطر
           المدينة (1580م)، فكانت الأشياء
           البعيدة (والقبة السماوية) تختفي
           فجأة قبل نهاية الخريطة.
        */
        3000

    );

camera.position.set(
    0,
    5,
    -10
);


/* =========================================================
   RENDERER
========================================================= */

const renderer=
    new THREE.WebGLRenderer({

        /*
           عطّلنا التنعيم (antialiasing) لأنه
           من أكبر مستهلكي أداء الـ GPU على
           الهاتف، ولا علاقة له بأي كائن في
           المشهد — فقط حدة حواف الرسم.
        */
        antialias:false,

        powerPreference:
        "high-performance"

    });

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio||1,
        1.5
    )
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputEncoding=
    THREE.sRGBEncoding;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

renderer.shadowMap.enabled=true;

/*
   خفّضنا نوع الظل من الناعم المكلف (PCFSoft)
   إلى النوع العادي (PCF) — السيارة فقط تُلقي
   ظلاً في اللعبة أصلاً، فالفرق البصري ضئيل
   جداً، لكنه يوفر تكلفة كبيرة لكل بكسل.
*/
renderer.shadowMap.type=
    THREE.PCFShadowMap;

document.body.appendChild(
    renderer.domElement
);


/* =========================================================
   LIGHT
========================================================= */

const hemisphere=
    new THREE.HemisphereLight(
        0xffffff,
        0x426a3d,
        1.25
    );

scene.add(
    hemisphere
);


const sun=
    new THREE.DirectionalLight(
        0xfff0d0,
        1.25
    );

sun.position.set(
    50,
    100,
    -50
);

sun.castShadow=true;

sun.shadow.mapSize.width=1024;
sun.shadow.mapSize.height=1024;

sun.shadow.camera.left=-100;
sun.shadow.camera.right=100;
sun.shadow.camera.top=100;
sun.shadow.camera.bottom=-100;

sun.shadow.camera.near=1;
sun.shadow.camera.far=300;

scene.add(sun);
scene.add(sun.target);


/* =========================================================
   SKY
========================================================= */

const sky=
    new THREE.Mesh(

        new THREE.SphereGeometry(
            /*
               كانت 600 فقط — أصغر من نصف
               مساحة المدينة (1580م)، لذلك
               كان يخرج منها ويرى "جداراً"
               بلون السماء عند حواف الخريطة.
            */
            2500,
            16,
            8
        ),

        new THREE.ShaderMaterial({

            side:
            THREE.BackSide,

            uniforms:{

                top:{
                    value:
                    new THREE.Color(
                        0x479ee5
                    )
                },

                bottom:{
                    value:
                    new THREE.Color(
                        0xe5f7ff
                    )
                }

            },

            vertexShader:`

                varying vec3 vPos;

                void main(){

                    vPos=
                    (modelMatrix*
                    vec4(position,1.0)).xyz;

                    gl_Position=
                    projectionMatrix*
                    modelViewMatrix*
                    vec4(position,1.0);
                }

            `,

            fragmentShader:`

                varying vec3 vPos;

                uniform vec3 top;
                uniform vec3 bottom;

                void main(){

                    float h=
                    normalize(vPos).y;

                    float f=
                    smoothstep(
                        -0.2,
                        0.8,
                        h
                    );

                    gl_FragColor=
                    vec4(
                        mix(
                            bottom,
                            top,
                            f
                        ),
                        1.0
                    );
                }

            `

        })

    );

scene.add(sky);


/* =========================================================
   GROUND
========================================================= */

const ground=
    new THREE.Mesh(

        new THREE.PlaneGeometry(
            4200,
            4200
        ),

        new THREE.MeshStandardMaterial({

            /* أخضر عشبي ليتطابق مع لون شفرات العشب */
            color:0x4e8f3d,

            roughness:1

        })

    );

ground.rotation.x=
    -Math.PI/2;

ground.position.y=
    -.08;

ground.receiveShadow=true;

scene.add(ground);

/* Ambient floating dust for depth */
const dustGeo=new THREE.BufferGeometry();
const dustPos=new Float32Array(700*3);
for(let i=0;i<700;i++){
    dustPos[i*3]=(Math.random()-.5)*260;
    dustPos[i*3+1]=1+Math.random()*10;
    dustPos[i*3+2]=-100+Math.random()*1500;
}
dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xffffff,size:.035,transparent:true,opacity:.22,depthWrite:false}));
scene.add(dust);



/* =========================================================
   MAIN ROAD
========================================================= */

/*
   الشارع الرئيسي أصبح جادة مستقيمة
   في منتصف المدينة (المحور x = 0).
*/

function mainRoadX(z){

    return 0;

}


/* =========================================================
   RIBBON
========================================================= */

function createRibbon(
    points,
    width,
    material
){

    const positions=[];
    const indices=[];

    for(
        let i=0;
        i<points.length;
        i++
    ){

        const p=
            points[i];

        const prev=
            points[
                Math.max(0,i-1)
            ];

        const next=
            points[
                Math.min(
                    points.length-1,
                    i+1
                )
            ];

        const dx=
            next.x-prev.x;

        const dz=
            next.z-prev.z;

        const len=
            Math.sqrt(
                dx*dx+
                dz*dz
            )||1;

        const nx=
            -dz/len;

        const nz=
            dx/len;

        positions.push(

            p.x+
            nx*width/2,

            p.y,

            p.z+
            nz*width/2,

            p.x-
            nx*width/2,

            p.y,

            p.z-
            nz*width/2

        );

        if(
            i<
            points.length-1
        ){

            const a=i*2;

            indices.push(

                a,
                a+2,
                a+1,

                a+1,
                a+2,
                a+3

            );
        }
    }

    const geometry=
        new THREE.BufferGeometry();

    geometry.setAttribute(

        "position",

        new THREE.Float32BufferAttribute(
            positions,
            3
        )

    );

    geometry.setIndex(
        indices
    );

    geometry.computeVertexNormals();

    return new THREE.Mesh(
        geometry,
        material
    );
}


/* =========================================================
   ROADS
========================================================= */

const roads=[];
const branches=[];


const roadMaterial=
    new THREE.MeshStandardMaterial({

        color:0x292929,

        roughness:.97

    });


/* =========================================================
   ROAD EDGE MATERIALS
========================================================= */

const whiteRoadMaterial=
    new THREE.MeshBasicMaterial({
        color:0xffffff
    });


const yellowRoadMaterial=
    new THREE.MeshBasicMaterial({
        color:0xffd52a
    });


const shoulderMaterial=
    new THREE.MeshBasicMaterial({
        color:0x555555
    });


function createEdges(
    points,
    width
){

    const left=[];
    const right=[];

    for(
        let i=0;
        i<points.length;
        i++
    ){

        const p=
            points[i];

        const prev=
            points[
                Math.max(0,i-1)
            ];

        const next=
            points[
                Math.min(
                    points.length-1,
                    i+1
                )
            ];

        const dx=
            next.x-prev.x;

        const dz=
            next.z-prev.z;

        const len=
            Math.sqrt(
                dx*dx+
                dz*dz
            )||1;

        const nx=
            -dz/len;

        const nz=
            dx/len;

        left.push({

            x:
            p.x+
            nx*(width/2-.5),

            y:.055,

            z:
            p.z+
            nz*(width/2-.5)

        });

        right.push({

            x:
            p.x-
            nx*(width/2-.5),

            y:.055,

            z:
            p.z-
            nz*(width/2-.5)

        });
    }

    scene.add(
        createRibbon(
            left,
            .18,
            whiteRoadMaterial
        )
    );

    scene.add(
        createRibbon(
            right,
            .18,
            whiteRoadMaterial
        )
    );
}

/*
   الشوارع (بما فيها الجادة الوسطى) تُرسم بالكامل
   عبر نظام الشبكة (CITY GRID) لاحقاً في الملف —
   يشمل ذلك حواف الطريق والخط الأصفر المتقطع.
*/


/* =========================================================
   BRANCH
========================================================= */

function createStraightRoadSegment(
    originX,
    originZ,
    dirX,
    dirZ,
    length,
    width,
    level
){

    const points=[];
    const steps=10;

    for(
        let i=0;
        i<=steps;
        i++
    ){

        const t=
            i/steps;

        points.push({

            x:originX+
            dirX*length*t,

            y:.025,

            z:originZ+
            dirZ*length*t

        });
    }


    const branchRoad=
        createRibbon(

            points,

            width,

            roadMaterial

        );

    branchRoad.receiveShadow=true;

    scene.add(
        branchRoad
    );


    roads.push({

        points:points,

        width:width,

        type:"branch"

    });


    let minX=Infinity,maxX=-Infinity;
    let minZ=Infinity,maxZ=-Infinity;

    for(const p of points){
        if(p.x<minX) minX=p.x;
        if(p.x>maxX) maxX=p.x;
        if(p.z<minZ) minZ=p.z;
        if(p.z>maxZ) maxZ=p.z;
    }

    const margin=width+25;


    branches.push({

        points:points,

        side:dirX>=0?1:-1,

        junctionZ:originZ,

        level:level,

        minX:minX-margin,
        maxX:maxX+margin,
        minZ:minZ-margin,
        maxZ:maxZ+margin

    });


    const left=[];
    const right=[];

    const edgeOffset=
        width*.46;


    for(
        let i=0;
        i<points.length;
        i++
    ){

        const p=points[i];

        const prev=
            points[
                Math.max(0,i-1)
            ];

        const next=
            points[
                Math.min(
                    points.length-1,
                    i+1
                )
            ];

        const dx=
            next.x-prev.x;

        const dz=
            next.z-prev.z;

        const len=
            Math.sqrt(
                dx*dx+
                dz*dz
            )||1;

        const nx=-dz/len;
        const nz=dx/len;


        left.push({

            x:p.x+
            nx*edgeOffset,

            y:.06,

            z:p.z+
            nz*edgeOffset

        });


        right.push({

            x:p.x-
            nx*edgeOffset,

            y:.06,

            z:p.z-
            nz*edgeOffset

        });
    }


    scene.add(
        createRibbon(
            left,
            .15,
            whiteRoadMaterial
        )
    );

    scene.add(
        createRibbon(
            right,
            .15,
            whiteRoadMaterial
        )
    );


    /*
       خطوط صفراء أقل عدداً
       حتى لا نثقل الهاتف.
    */

    for(
        let i=0;
        i<points.length-1;
        i+=3
    ){

        const a=points[i];
        const b=points[
            Math.min(
                points.length-1,
                i+1
            )
        ];

        scene.add(

            createRibbon(

                [
                    {
                        x:a.x,
                        y:.07,
                        z:a.z
                    },

                    {
                        x:b.x,
                        y:.07,
                        z:b.z
                    }
                ],

                .14,

                yellowRoadMaterial

            )

        );
    }


    return points;
}


/* =========================================================
   BRANCH TREE
   (فرع يؤدي إلى فرع آخر، طرق مستقيمة،
   تشكل شبكة مدينة حقيقية)
========================================================= */

/* =========================================================
   CITY GRID
   شبكة شوارع مدينة حقيقية داخل حدود 10 كم²:
   جادات رئيسية + شوارع فرعية، كلها مستقيمة
   ومتقاطعة، والفروع امتداد فعلي للمدينة.
========================================================= */

const cityRoadLines=[];


function buildCityGrid(){

    const half=
        CONFIG.CITY_HALF;

    const step=
        CONFIG.GRID_STEP;

    /* عدد الشوارع في كل اتجاه */
    const count=
        Math.round(half*2/step);


    for(
        let i=0;
        i<=count;
        i++
    ){

        const coord=
            -half+i*step;


        /*
           كل شارع ثالث جادة عريضة،
           والباقي شوارع فرعية.
        */

        const isAvenue=
            (i%3===0) ||
            Math.abs(coord)<.6;

        const width=
            isAvenue
            ?18
            :11;


        /*
           شارع عمودي (يمتد على محور z) —
           يُنشأ دائماً، حتى عند x=0، لضمان
           وجود جادة رئيسية عمودية في منتصف
           المدينة (لم تكن موجودة سابقاً).
        */

        cityRoadLines.push({

            axis:"z",

            coord:coord,

            width:width,

            type:isAvenue?"main":"branch"

        });


        /* شارع أفقي (يمتد على محور x) */
        cityRoadLines.push({

            axis:"x",

            coord:coord,

            width:width,

            type:isAvenue?"main":"branch"

        });
    }
}


buildCityGrid();


function createGridRoad(line){

    const half=
        CONFIG.CITY_HALF;

    const points=[];

    const steps=12;


    for(
        let i=0;
        i<=steps;
        i++
    ){

        const t=
            -half+
            (half*2)*(i/steps);


        points.push(
            line.axis==="z"
            ?{x:line.coord,y:.025,z:t}
            :{x:t,y:.025,z:line.coord}
        );
    }


    const roadMesh=
        createRibbon(
            points,
            line.width,
            roadMaterial
        );

    roadMesh.receiveShadow=true;

    scene.add(roadMesh);


    roads.push({

        points:points,

        width:line.width,

        type:line.type

    });


    const margin=
        line.width*.5+2;


    branches.push({

        points:points,

        side:1,

        junctionZ:0,

        level:1,

        minX:
        line.axis==="z"
        ?line.coord-margin
        :-half-margin,

        maxX:
        line.axis==="z"
        ?line.coord+margin
        :half+margin,

        minZ:
        line.axis==="z"
        ?-half-margin
        :line.coord-margin,

        maxZ:
        line.axis==="z"
        ?half+margin
        :line.coord+margin

    });


    /* خطوط الحواف البيضاء */

    const edgeOffset=
        line.width*.46;


    for(
        const side
        of [-1,1]
    ){

        const edge=
            points.map(
                function(pt){

                    return (
                        line.axis==="z"
                        ?{
                            x:pt.x+side*edgeOffset,
                            y:.06,
                            z:pt.z
                        }
                        :{
                            x:pt.x,
                            y:.06,
                            z:pt.z+side*edgeOffset
                        }
                    );
                }
            );


        scene.add(
            createRibbon(
                edge,
                .15,
                whiteRoadMaterial
            )
        );
    }


    /* خط المنتصف المتقطع للجادات فقط */

    if(line.type!=="main")
        return;


    const dash=7;
    const gap=9;

    for(
        let t=-half;
        t<half;
        t+=dash+gap
    ){

        const t2=
            Math.min(half,t+dash);


        scene.add(

            createRibbon(

                line.axis==="z"
                ?[
                    {x:line.coord,y:.07,z:t},
                    {x:line.coord,y:.07,z:t2}
                ]
                :[
                    {x:t,y:.07,z:line.coord},
                    {x:t2,y:.07,z:line.coord}
                ],

                .16,

                yellowRoadMaterial

            )

        );
    }
}


for(
    const line
    of cityRoadLines
){

    createGridRoad(line);
}


/* =========================================================
   DISTANCE POINT SEGMENT
========================================================= */

function distancePointSegment(
    px,
    pz,
    ax,
    az,
    bx,
    bz
){

    const vx=bx-ax;
    const vz=bz-az;

    const wx=px-ax;
    const wz=pz-az;

    const len=
        vx*vx+
        vz*vz;

    let t=0;

    if(len>0){

        t=
        (
            wx*vx+
            wz*vz
        )/
        len;
    }

    t=
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );

    const x=
        ax+vx*t;

    const z=
        az+vz*t;

    return Math.sqrt(

        (px-x)*(px-x)+
        (pz-z)*(pz-z)

    );
}


/* =========================================================
   ROAD SEARCH
========================================================= */

function nearestRoad(
    x,
    z
){

    let result={

        distance:Infinity,

        x:x,

        z:z,

        width:22

    };


    /*
       الطريق الرئيسي له معادلة مباشرة،
       فلا نبحث في آلاف المقاطع.
    */

    const mainX=
        mainRoadX(z);

    const mainDistance=
        Math.abs(
            x-mainX
        );


    if(
        mainDistance<
        result.distance
    ){

        result.distance=
            mainDistance;

        result.x=
            mainX;

        result.z=z;

        result.width=22;
    }


    /*
       نفحص الفروع القريبة فقط.
    */

    for(
        const branch
        of branches
    ){

        if(
            x<branch.minX ||
            x>branch.maxX ||
            z<branch.minZ ||
            z>branch.maxZ
        )
            continue;


        const pts=
            branch.points;


        for(
            let i=0;
            i<pts.length-1;
            i++
        ){

            const a=pts[i];
            const b=pts[i+1];


            if(
                Math.abs(
                    z-a.z
                )>25
            )
                continue;


            const d=
                distancePointSegment(

                    x,
                    z,

                    a.x,
                    a.z,

                    b.x,
                    b.z

                );


            if(
                d<
                result.distance
            ){

                const vx=
                    b.x-a.x;

                const vz=
                    b.z-a.z;

                const wx=
                    x-a.x;

                const wz=
                    z-a.z;

                const len=
                    vx*vx+
                    vz*vz;

                let t=
                    len
                    ?
                    (
                        wx*vx+
                        wz*vz
                    )/
                    len
                    :
                    0;

                t=
                    Math.max(
                        0,
                        Math.min(
                            1,
                            t
                        )
                    );

                result.distance=d;

                result.x=
                    a.x+vx*t;

                result.z=
                    a.z+vz*t;

                result.width=
                    10;
            }
        }
    }


    return result;
}


/* =========================================================
   GLB
========================================================= */

let treeTemplate=null;
let buildingTemplate=null;
let personTemplate=null;

let loader=null;

try{

    loader=
        new GLTFLoader();

    const draco=
        new DRACOLoader();

    draco.setDecoderPath(
        "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );

    loader.setDRACOLoader(
        draco
    );

}catch(error){

    console.log(
        "GLTF unavailable"
    );
}


/* =========================================================
   MODEL PREPARE
========================================================= */

function prepareModel(
    object,
    type
){

    if(!object)
        return;


    object.traverse(
        function(mesh){

            if(!mesh.isMesh)
                return;

            mesh.castShadow=
                type==="car";

            mesh.receiveShadow=false;


            const materials=
                Array.isArray(
                    mesh.material
                )
                ?
                mesh.material
                :
                [
                    mesh.material
                ];


            for(
                const mat
                of materials
            ){

                if(!mat)
                    continue;


                if(mat.map){

                    mat.map.encoding=
                        THREE.sRGBEncoding;

                    mat.map.needsUpdate=true;
                }


                if(type==="building"){

                    if(mat.color){

                        mat.color.lerp(
                            new THREE.Color(0x6b4226),
                            0.25
                        );
                    }

                    if("emissive" in mat){

                        mat.emissive=
                            new THREE.Color(0x2a1608);

                        mat.emissiveIntensity=
                            0.18;
                    }
                }
            }
        }
    );
}


/* =========================================================
   MODEL ASSETS
   GLB files were extracted from the original HTML into public/models/.
========================================================= */


/* =========================================================
   LOAD GLB
========================================================= */

function loadGLB(
    path,
    callback
){

    if(!loader){
        callback(null);
        return;
    }

    let finished=false;

    const done=function(model){
        if(finished) return;
        finished=true;
        callback(model || null);
    };

    try{
        loader.load(
            path.startsWith("/") ? path : "/" + path,
            function(gltf){
                if(gltf && gltf.scene){
                    done(gltf.scene);
                }else{
                    done(null);
                }
            },
            undefined,
            function(error){
                console.warn("GLB could not be loaded:", path, error || "unknown error");
                done(null);
            }
        );
    }catch(error){
        console.warn("GLB load failed:", path, error);
        done(null);
    }
}


/* =========================================================
   START
========================================================= */

animate();


})();

