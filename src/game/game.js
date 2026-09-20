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
       الأزرار الآن موصولة بشكل صحيح:
       زر "أمام" -> input.forward  -> تسارع موجب
       زر "خلف"  -> input.backward -> رجوع
    */

    MAX_SPEED:150,

    MAX_REVERSE:50,

    /*
       سرعة مرجعية لحساب حدّة المقود فقط.
       تُبقي إحساس القيادة كما كان قبل رفع
       السقف إلى 150، وإلا صار المقود بليداً
       في السرعات المنخفضة.
    */

    STEER_REFERENCE_SPEED:50,

    ACCELERATION:34,

    BRAKE:55,

    FRICTION:7,

    STEERING:2.25,

    /*
       رُفعت هذه الأسقف لأن شبكة شوارع
       المدينة الآن أطول بكثير من الممر
       الواحد السابق (~66 كم من الشوارع).
    */

    /*
       يُوزَّع هذا العدد الآن على كل المدينة
       لا على أول شوارعها. خفّضه إن ثقل
       الأداء على الهاتف.
    */
    MAX_TREES:900,

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

/*
   مدى الرؤية: واضح تماماً حتى 50م،
   ثم تلاشٍ تدريجي حتى 150م،
   وبعدها لا يظهر شيء إطلاقاً.
*/
scene.fog=
    new THREE.Fog(
        0xb9deef,
        50,
        150
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
    3.3,
    -5
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
    -35,
    100,
    130
);

sun.castShadow=true;

sun.shadow.mapSize.width=1024;
sun.shadow.mapSize.height=1024;

/*
   الظلال البعيدة لا فائدة منها لأنها
   خلف الضباب أصلاً. تقليص الصندوق إلى
   55م يحصر الظل في المباني القريبة
   ويضاعف دقته بنفس حجم خريطة الظل.
*/
sun.shadow.camera.left=-55;
sun.shadow.camera.right=55;
sun.shadow.camera.top=55;
sun.shadow.camera.bottom=-55;

sun.shadow.camera.near=1;
sun.shadow.camera.far=250;

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
let sunModel=null;

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
   EMBEDDED MODEL DATA (base64, compressed)
========================================================= */

// Models are loaded from public/models/*.glb in the Vite project.
const EMBEDDED_MODELS = {};




/* =========================================================
   LOAD GLB
========================================================= */

function base64ToArrayBuffer(base64){
    const binaryString=atob(base64);
    const len=binaryString.length;
    const bytes=new Uint8Array(len);
    for(let i=0;i<len;i++){
        bytes[i]=binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

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

        const embeddedData=
            (typeof EMBEDDED_MODELS!=="undefined")
            ? EMBEDDED_MODELS[path]
            : null;

        if(embeddedData){

            const buffer=base64ToArrayBuffer(embeddedData);

            loader.parse(
                buffer,
                "",
                function(gltf){
                    if(gltf && gltf.scene){
                        done(gltf.scene);
                    }else{
                        done(null);
                    }
                },
                function(error){
                    console.warn("Embedded GLB could not be parsed:", path, error || "unknown error");
                    done(null);
                }
            );

            return;
        }

        loader.load(
            path,
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
        console.warn("GLB load error:", path, error);
        done(null);
    }
}


/* =========================================================
   FALLBACK MODELS
   (simple primitive shapes used when a .glb file
   fails to load or is missing)
========================================================= */

function createFallbackCar(){
    const g=new THREE.Group();

    const bodyMat=new THREE.MeshStandardMaterial({color:0xd63a3a,metalness:.3,roughness:.5});
    const cabinMat=new THREE.MeshStandardMaterial({color:0x1c2733,metalness:.2,roughness:.4});
    const wheelMat=new THREE.MeshStandardMaterial({color:0x151515,metalness:.1,roughness:.9});

    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.7,4.2),bodyMat);
    body.position.y=.55;
    g.add(body);

    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.5,.55,2.1),cabinMat);
    cabin.position.set(0,1.05,-.2);
    g.add(cabin);

    const wheelGeo=new THREE.CylinderGeometry(.35,.35,.3,14);
    const wheelPositions=[
        [-.95,.35,1.4],[.95,.35,1.4],
        [-.95,.35,-1.4],[.95,.35,-1.4]
    ];
    for(const p of wheelPositions){
        const wheel=new THREE.Mesh(wheelGeo,wheelMat);
        wheel.rotation.z=Math.PI/2;
        wheel.position.set(p[0],p[1],p[2]);
        g.add(wheel);
    }

    return g;
}

function createFallbackTree(){
    const g=new THREE.Group();

    const trunkMat=new THREE.MeshStandardMaterial({color:0x704523,roughness:.9});
    const leavesMat=new THREE.MeshStandardMaterial({color:0x248b3d,roughness:.8});

    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,1.4,8),trunkMat);
    trunk.position.y=.7;
    g.add(trunk);

    const leaves=new THREE.Mesh(new THREE.ConeGeometry(1.1,2.4,10),leavesMat);
    leaves.position.y=2.5;
    g.add(leaves);

    return g;
}

function createFallbackBuilding(){
    const g=new THREE.Group();

    const wallMat=new THREE.MeshStandardMaterial({color:0x8a8f96,roughness:.85});
    const roofMat=new THREE.MeshStandardMaterial({color:0x5c6066,roughness:.8});

    const height=8+Math.random()*10;

    const walls=new THREE.Mesh(new THREE.BoxGeometry(6,height,6),wallMat);
    walls.position.y=height/2;
    g.add(walls);

    const roof=new THREE.Mesh(new THREE.BoxGeometry(6.4,.4,6.4),roofMat);
    roof.position.y=height+.2;
    g.add(roof);

    return g;
}

function createFallbackPerson(){
    const g=new THREE.Group();

    const skinMat=new THREE.MeshStandardMaterial({color:0xe0a978,roughness:.8});
    const clothesMat=new THREE.MeshStandardMaterial({color:0x3a6ea5,roughness:.8});

    const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,1.1,8),clothesMat);
    body.position.y=.85;
    g.add(body);

    const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,10),skinMat);
    head.position.y=1.55;
    g.add(head);

    return g;
}


/* =========================================================
   CAR
========================================================= */

let car=
    createFallbackCar();


car.position.set(
    mainRoadX(0),
    0,
    0
);

car.userData.loaded=false;
car.userData.modelType="car";

scene.add(car);


/* =========================================================
   CAR GROUND
========================================================= */

let carGroundY=0;


function placeOnGround(
    object
){

    if(!object)
        return;


    const box=
        new THREE.Box3()
        .setFromObject(object);


    object.position.y +=
        -box.min.y+
        .04;
}


/* =========================================================
   LOAD CAR
========================================================= */

loadGLB(
    "models/car.glb",
    function(model){

        if(!model)
            return;


        prepareModel(
            model,
            "car"
        );


        const box=
            new THREE.Box3()
            .setFromObject(
                model
            );


        const size=
            new THREE.Vector3();


        box.getSize(size);


        const largest=
            Math.max(
                size.x,
                size.z
            );


        if(largest>0){

            const scale=
                4.3/largest;

            model.scale.setScalar(
                scale
            );
        }


        const afterScale=
            new THREE.Box3()
            .setFromObject(
                model
            );


        carGroundY=
            -afterScale.min.y+
            .05;


        model.position.set(

            car.position.x,

            carGroundY,

            car.position.z

        );


        model.rotation.y=
            car.rotation.y;


        scene.remove(car);

        car=model;

        car.userData.loaded=true;
        car.userData.modelType="car";

        scene.add(car);
    }
);


/* =========================================================
   SAFE GLB MODEL HELPERS
========================================================= */

function getModelHeight(object){
    if(!object) return 0;
    try{
        object.updateMatrixWorld(true);
        const box=new THREE.Box3().setFromObject(object);
        const height=box.max.y-box.min.y;
        return Number.isFinite(height) ? height : 0;
    }catch(error){
        return 0;
    }
}

function normalizeModelHeight(object, targetHeight){
    if(!object || !targetHeight) return;
    const height=getModelHeight(object);
    if(height>0.01){
        object.scale.multiplyScalar(targetHeight/height);
    }
}

function cloneGLBForUse(template, type, instanceScale, targetHeight){
    if(!template) return null;

    const object=template.clone(true);
    prepareModel(object,type);
    normalizeModelHeight(object,targetHeight);
    object.scale.multiplyScalar(instanceScale || 1);
    object.userData.modelType=type;
    return object;
}

function replaceLoadedDecoration(type, template, targetHeight){
    if(!template || typeof collisionObjects==='undefined') return;

    for(const item of collisionObjects){
        if(!item || !item.object || item.type!==type) continue;
        if(item.object.userData.modelType!=='fallback-'+type) continue;

        const oldObject=item.object;
        const oldScale=oldObject.scale.clone();
        const replacement=template.clone(true);
        prepareModel(replacement,type);
        normalizeModelHeight(replacement,targetHeight);

        // Preserve the fallback instance's transform/size as closely as possible.
        replacement.position.copy(oldObject.position);
        replacement.rotation.copy(oldObject.rotation);
        replacement.scale.multiply(oldScale);
        replacement.userData.modelType=type;

        scene.add(replacement);
        placeOnGround(replacement);
        scene.remove(oldObject);
        item.object=replacement;
    }

    if(type==='person' && typeof people!=='undefined'){
        for(const walker of people){
            if(!walker || !walker.object) continue;
            if(walker.object.userData.modelType!=='fallback-person') continue;

            const oldObject=walker.object;
            const oldScale=oldObject.scale.clone();
            const replacement=template.clone(true);
            prepareModel(replacement,type);
            normalizeModelHeight(replacement,targetHeight);
            replacement.position.copy(oldObject.position);
            replacement.rotation.copy(oldObject.rotation);
            replacement.scale.multiply(oldScale);
            replacement.userData.modelType=type;
            scene.add(replacement);
            placeOnGround(replacement);
            scene.remove(oldObject);
            walker.object=replacement;
        }
    }
}

/* =========================================================
   OTHER GLB
========================================================= */

loadGLB(
    "models/tree.glb",
    function(model){

        if(model){

            prepareModel(
                model,
                "tree"
            );

            normalizeModelHeight(model,4.5);
            treeTemplate=model;
            replaceLoadedDecoration("tree", treeTemplate, 4.5);
        }
    }
);


loadGLB(
    "models/building.glb",
    function(model){

        if(model){

            prepareModel(
                model,
                "building"
            );

            normalizeModelHeight(model,18);
            buildingTemplate=model;
            replaceLoadedDecoration("building", buildingTemplate, 18);
        }
    }
);


loadGLB(
    "models/person.glb",
    function(model){

        if(model){

            prepareModel(
                model,
                "person"
            );

            normalizeModelHeight(model,2.1);
            personTemplate=model;
            replaceLoadedDecoration("person", personTemplate, 2.1);
        }
    }
);


/* =========================================================
   SUN MODEL  (models/sun.glb)
   قرص الشمس المرئي في السماء.
   يقف دائماً في نفس اتجاه الضوء الموجَّه
   ويتبع السيارة مثل قبة السماء، فلا يخرج
   من المشهد عند الابتعاد عن مركز المدينة.
========================================================= */

/*
   أمام السائق مباشرة (Z موجب = اتجاه القيادة
   عند بداية اللعبة)، ومائلة قليلاً إلى اليسار.
   الارتفاع منخفض عمداً (~8 درجات) لأن الكاميرا
   تنظر إلى الأسفل قليلاً، فالقرص العالي يقع
   فوق حافة الشاشة ولا يُرى.
*/
const SUN_DIRECTION=
    new THREE.Vector3(
        -35,
        19,
        130
    ).normalize();


/*
   مسافة القرص عن السيارة:
   داخل قبة السماء (2500)
   وقبل حد الكاميرا البعيد (3000).
*/
const SUN_DISTANCE=1400;


/* ارتفاع القرص بعد توحيد المقاس */
const SUN_SIZE=130;


function prepareSunModel(object){

    if(!object)
        return;


    object.traverse(
        function(mesh){

            if(!mesh.isMesh)
                return;


            mesh.castShadow=false;
            mesh.receiveShadow=false;

            /*
               القرص بعيد جداً عن السيارة،
               وبدون هذا السطر قد يختفي
               عند دوران الكاميرا بسرعة.
            */
            mesh.frustumCulled=false;


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


            const converted=[];


            for(
                const mat
                of materials
            ){

                if(!mat){
                    converted.push(mat);
                    continue;
                }


                /*
                   الشمس مصدر ضوء لا سطح مُضاء،
                   لذلك تُحوَّل خاماتها إلى Basic
                   حتى تبقى ساطعة مهما كان اتجاه
                   الإضاءة أو موقع السيارة.
                */

                const basic=
                    new THREE.MeshBasicMaterial({

                        color:
                        mat.color
                        ? mat.color.clone()
                        : new THREE.Color(0xfff2b0),

                        map:
                        mat.map || null,

                        transparent:
                        mat.transparent===true,

                        opacity:
                        typeof mat.opacity==="number"
                        ? mat.opacity
                        : 1,

                        fog:false,

                        toneMapped:false

                    });


                if(basic.map){

                    basic.map.encoding=
                        THREE.sRGBEncoding;

                    basic.map.needsUpdate=true;
                }


                converted.push(basic);
            }


            mesh.material=
                Array.isArray(
                    mesh.material
                )
                ?
                converted
                :
                converted[0];
        }
    );
}


function updateSunModel(){

    if(!sunModel)
        return;


    sunModel.position.set(

        car.position.x+
        SUN_DIRECTION.x*SUN_DISTANCE,

        SUN_DIRECTION.y*SUN_DISTANCE,

        car.position.z+
        SUN_DIRECTION.z*SUN_DISTANCE

    );


    /* يواجه الكاميرا دائماً */
    sunModel.lookAt(
        camera.position
    );
}


loadGLB(
    "models/sun.glb",
    function(model){

        if(!model)
            return;


        prepareSunModel(model);

        normalizeModelHeight(
            model,
            SUN_SIZE
        );

        model.userData.modelType="sun";

        sunModel=model;

        updateSunModel();

        scene.add(sunModel);
    }
);


/* =========================================================
   INTERIOR VIEW — منظور السائق
   كاميرا داخل السيارة، ومقود يدور مع الانعطاف.
   لا يوجد زجاج مرسوم: فتحة الرؤية مفتوحة
   تماماً فيظهر ما خارج السيارة كما هو.
========================================================= */

let interiorView=false;

/* المجموعة الحاملة: الموضع أمام السائق والميل */
let wheelRig=null;

/* مجموعة الدوران وحدها، تدور حول محورها فقط */
let wheelSpin=null;

/* قيمة ناعمة بين -1 و 1 تمثل وضع المقود */
let steerVisual=0;


/* موضع عين السائق داخل السيارة بالأمتار */
const DRIVER_EYE=
    new THREE.Vector3(
        .38,
        1.15,
        -.25
    );


/* أقصى دوران للمقود بالتقدير الدائري */
const WHEEL_MAX_TURN=1.25;


/*
   أبناء الكاميرا لا تُرسم ما لم تكن
   الكاميرا نفسها جزءاً من المشهد.
*/
scene.add(camera);


loadGLB(
    "models/scan.glb",
    function(model){

        if(!model)
            return;


        model.traverse(
            function(mesh){

                if(!mesh.isMesh)
                    return;

                mesh.castShadow=false;
                mesh.receiveShadow=false;
                mesh.frustumCulled=false;
            }
        );


        /* قطر المقود 38 سم */
        normalizeModelHeight(
            model,
            .38
        );


        /*
           أصل النموذج عند حافته السفلى لا في
           مركزه. بدون هذه الإزاحة سيدور المقود
           حول أسفله فيترنح بدل أن يلف.
        */

        const box=
            new THREE.Box3()
            .setFromObject(model);

        const center=
            new THREE.Vector3();

        box.getCenter(center);

        model.position.sub(center);


        wheelSpin=
            new THREE.Group();

        wheelSpin.add(model);


        wheelRig=
            new THREE.Group();

        wheelRig.add(wheelSpin);


        /*
           الكاميرا تنظر نحو -Z في إحداثياتها
           المحلية، فالقيم السالبة أمامها.
        */

        wheelRig.position.set(
            0,
            -.26,
            -.55
        );


        /* ميل المقود: قمته أبعد عن السائق */
        wheelRig.rotation.x=-.32;

        wheelRig.visible=interiorView;


        camera.add(wheelRig);
    }
);


function setInteriorView(on){

    interiorView=on===true;


    /* من الداخل لا داعي لرسم هيكل السيارة */
    car.visible=!interiorView;


    if(wheelRig)
        wheelRig.visible=interiorView;


    const button=
        document.getElementById(
            "viewToggle"
        );

    if(button)
        button.textContent=
            interiorView
            ?"🎥 خارجي"
            :"🚗 داخلي";
}


const viewToggleElement=
    document.getElementById(
        "viewToggle"
    );

if(viewToggleElement)
    viewToggleElement.addEventListener(
        "click",
        function(){
            setInteriorView(!interiorView);
        }
    );


window.addEventListener(
    "keydown",
    function(e){

        if(
            e.key==="v"||
            e.key==="V"
        )
            setInteriorView(!interiorView);
    }
);


/* =========================================================
   GRASS
   عشب متراصف يغطي مساحات المدينة بين الشوارع.
   ملاحظات مهمة:
   - نموذجك يحتوي شبكتين: قاعدة تربة (soil_base)
     وشفرات العشب. نستبعد قاعدة التربة تماماً،
     لأنها كانت هي المربعات البنية التي تغطي
     الأرض الخضراء وتمتد فوق الشارع.
   - نستخدم بلاطات مستطيلة بنفس نسبة أبعاد
     النموذج، فتتلاصق بلا فراغات بينها.
========================================================= */

const GRASS_CONFIG={

    /*
       معامل تكبير رقعة العشب.
       أكبر = تغطية أبعد بعدد بلاطات أقل
       (نرفعه مع نصف القطر معاً حتى يبقى
       عدد المثلثات كما هو تقريباً رغم
       زيادة مسافة الظهور).
    */
    SCALE:2.55,

    /* نسبة ارتفاع الشفرة (نُبقيه منخفضاً كعشب حديقة) */
    HEIGHT_RATIO:.5,

    /* نصف قطر الحقل المرئي حول السيارة — تمت زيادته ليظهر العشب من مسافة أبعد */
    RADIUS:170,

    /* المسافة الإضافية المتروكة حول حافة الشارع */
    ROAD_CLEAR:1,

    /* مقدار تحرك السيارة قبل إعادة بناء الحقل */
    REFRESH:28

};


let grassMeshes=[];
let grassCapacity=0;
let grassCenterX=Infinity;
let grassCenterZ=Infinity;

/* أبعاد البلاطة الواحدة (تُحسب من النموذج) */
let grassCellX=6;
let grassCellZ=4;

const grassDummy=
    new THREE.Object3D();


function grassTileIsFree(cx,cz){

    const half=
        CONFIG.CITY_HALF;

    if(
        cx<-half ||
        cx>half ||
        cz<-half ||
        cz>half
    )
        return false;


    const near=
        nearestRoad(cx,cz);

    /*
       نصف قطر البلاطة: نستخدم الضلع الأكبر
       حتى لا تتعدى أي رقعة على الأسفلت.
    */

    const tileRadius=
        Math.max(grassCellX,grassCellZ)*.5;


    return (
        near.distance>
        near.width*.5+
        GRASS_CONFIG.ROAD_CLEAR+
        tileRadius
    );
}


function rebuildGrassField(centerX,centerZ){

    if(!grassMeshes.length)
        return;


    const radius=
        GRASS_CONFIG.RADIUS;


    const i0=
        Math.floor((centerX-radius)/grassCellX);

    const i1=
        Math.ceil((centerX+radius)/grassCellX);

    const j0=
        Math.floor((centerZ-radius)/grassCellZ);

    const j1=
        Math.ceil((centerZ+radius)/grassCellZ);


    let count=0;


    for(
        let i=i0;
        i<=i1;
        i++
    ){

        if(count>=grassCapacity)
            break;


        for(
            let j=j0;
            j<=j1;
            j++
        ){

            if(count>=grassCapacity)
                break;


            /* مركز البلاطة على شبكة ثابتة */

            const cx=
                (i+.5)*grassCellX;

            const cz=
                (j+.5)*grassCellZ;


            const dx=cx-centerX;
            const dz=cz-centerZ;

            if(
                dx*dx+dz*dz>
                radius*radius
            )
                continue;


            if(!grassTileIsFree(cx,cz))
                continue;


            grassDummy.position.set(
                cx,
                0,
                cz
            );

            /*
               دوران 180° فقط (لا 90°) حتى تبقى
               البلاطات المستطيلة متلاصقة تماماً.
            */

            const flip=
                ((i*7+j*13)%2)
                ?Math.PI
                :0;

            grassDummy.rotation.set(
                0,
                flip,
                0
            );

            grassDummy.scale.set(
                GRASS_CONFIG.SCALE,

                GRASS_CONFIG.SCALE*
                GRASS_CONFIG.HEIGHT_RATIO,

                GRASS_CONFIG.SCALE
            );

            grassDummy.updateMatrix();


            for(
                const mesh
                of grassMeshes
            ){

                mesh.setMatrixAt(
                    count,
                    grassDummy.matrix
                );
            }

            count++;
        }
    }


    /* إخفاء البلاطات غير المستخدمة */

    grassDummy.position.set(0,-9999,0);
    grassDummy.rotation.set(0,0,0);
    grassDummy.scale.setScalar(.0001);
    grassDummy.updateMatrix();


    for(
        let k=count;
        k<grassCapacity;
        k++
    ){

        for(
            const mesh
            of grassMeshes
        ){

            mesh.setMatrixAt(
                k,
                grassDummy.matrix
            );
        }
    }


    for(
        const mesh
        of grassMeshes
    ){

        mesh.instanceMatrix.needsUpdate=true;

        /*
           هذا هو سبب اللاك الرئيسي: بدون كرة
           احتواء صحيحة، كان Three.js يرسم كل
           رقع العشب حتى خلف الكاميرا، دون تغيير
           عدد الرقع أو مواضعها — فقط نُصحّح
           حساب الرؤية.
        */

        if(!mesh.geometry.boundingSphere){

            mesh.geometry.boundingSphere=
                new THREE.Sphere();
        }

        mesh.geometry.boundingSphere.center.set(
            centerX,
            .3,
            centerZ
        );

        mesh.geometry.boundingSphere.radius=
            GRASS_CONFIG.RADIUS+40;
    }


    grassCenterX=centerX;
    grassCenterZ=centerZ;
}


function addGrassField(template){

    if(!template)
        return;


    template.updateMatrixWorld(true);


    /*
       نختار شبكة الشفرات فقط، ونتجاهل
       قاعدة التربة (أقل عدد رؤوس بكثير).
    */

    let bladeMesh=null;

    template.traverse(
        function(child){

            if(!child.isMesh)
                return;


            const name=
                (child.name||"").toLowerCase();

            if(
                name.indexOf("soil")>=0 ||
                name.indexOf("base")>=0 ||
                name.indexOf("dirt")>=0 ||
                name.indexOf("ground")>=0
            )
                return;


            const verts=
                child.geometry &&
                child.geometry.attributes &&
                child.geometry.attributes.position
                ? child.geometry.attributes.position.count
                : 0;


            if(
                !bladeMesh ||
                verts>bladeMesh.__verts
            ){

                bladeMesh=child;

                bladeMesh.__verts=verts;
            }
        }
    );


    if(!bladeMesh)
        return;


    const geometry=
        bladeMesh.geometry.clone();

    geometry.applyMatrix4(
        bladeMesh.matrixWorld
    );

    /* النموذج مصدَّر بمحور Z للأعلى */
    geometry.rotateX(-Math.PI/2);

    geometry.computeBoundingBox();


    const bb=
        geometry.boundingBox;

    const sizeX=
        bb.max.x-bb.min.x;

    const sizeZ=
        bb.max.z-bb.min.z;


    /*
       نُنزل النموذج ليجلس على الأرض تماماً،
       ونجعل مركزه أفقياً في منتصف البلاطة.
    */

    geometry.translate(
        -(bb.min.x+bb.max.x)*.5,
        -bb.min.y,
        -(bb.min.z+bb.max.z)*.5
    );


    /* أبعاد البلاطة = أبعاد الرقعة بعد التكبير */

    grassCellX=
        sizeX*GRASS_CONFIG.SCALE;

    grassCellZ=
        sizeZ*GRASS_CONFIG.SCALE;


    grassCapacity=
        Math.ceil(
            Math.PI*
            GRASS_CONFIG.RADIUS*
            GRASS_CONFIG.RADIUS/
            (grassCellX*grassCellZ)
        )+96;


    const material=
        Array.isArray(bladeMesh.material)
        ? bladeMesh.material[0].clone()
        : bladeMesh.material.clone();

    material.side=THREE.DoubleSide;


    const instanced=
        new THREE.InstancedMesh(
            geometry,
            material,
            grassCapacity
        );

    instanced.castShadow=false;
    instanced.receiveShadow=false;
    /*
       أعدنا تفعيل الحجب خارج مجال الرؤية —
       الآن آمن لأن كرة الاحتواء تُحدَّث مع
       موضع السيارة في rebuildGrassField.
       هذا وحده يوفر جزءاً كبيراً من التكلفة
       دون حذف أو تغيير أي رقعة عشب.
    */
    instanced.frustumCulled=true;

    instanced.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
    );

    scene.add(instanced);

    grassMeshes.push(instanced);


    rebuildGrassField(
        car?car.position.x:0,
        car?car.position.z:0
    );
}


function updateGrassField(){

    if(!grassMeshes.length || !car)
        return;


    const dx=
        car.position.x-grassCenterX;

    const dz=
        car.position.z-grassCenterZ;


    if(
        dx*dx+dz*dz>
        GRASS_CONFIG.REFRESH*
        GRASS_CONFIG.REFRESH
    ){

        rebuildGrassField(
            car.position.x,
            car.position.z
        );
    }
}


loadGLB(
    "models/grass.glb",
    function(model){

        if(model)
            addGrassField(model);
    }
);


/* =========================================================
   COLLISION OBJECTS
========================================================= */

const collisionObjects=[];


/* =========================================================
   VALID DECORATION
========================================================= */

function validDecorationPosition(
    x,
    z,
    clearance
){

    const road=
        nearestRoad(
            x,
            z
        );

    return (
        road.distance>
        clearance
    );
}


/* =========================================================
   TREE
========================================================= */

function addTree(
    x,
    z,
    scale
){

    const tree=
        treeTemplate
        ? cloneGLBForUse(treeTemplate,"tree",scale,4.5)
        : createFallbackTree();

    if(!tree) return;

    prepareModel(tree,"tree");
    if(!treeTemplate){
        tree.userData.modelType="fallback-tree";
        tree.scale.multiplyScalar(scale);
    }


    tree.position.set(
        x,
        0,
        z
    );


    placeOnGround(tree);

    scene.add(tree);


    collisionObjects.push({

        object:tree,

        type:"tree",

        radius:1.8

    });
}


function addBuilding(
    x,
    z,
    scale
){

    const building=
        buildingTemplate
        ? cloneGLBForUse(buildingTemplate,"building",scale,18)
        : createFallbackBuilding();

    if(!building) return;

    prepareModel(building,"building");
    if(!buildingTemplate){
        building.userData.modelType="fallback-building";
        building.scale.multiplyScalar(scale);
    }


    building.position.set(
        x,
        0,
        z
    );


    building.rotation.y=
        Math.random()*
        Math.PI*2;


    placeOnGround(
        building
    );


    scene.add(building);


    collisionObjects.push({

        object:building,

        type:"building",

        radius:5

    });
}


/* =========================================================
   CITY DECORATIONS
   نوزع الأشجار والمباني على كل بلوكات المدينة،
   بمحاذاة الشوارع من كل الجهات.
========================================================= */

let treeCount=0;
let buildingCount=0;


/*
   توزيع الأشجار على كامل المدينة.

   المشكلة السابقة: الحلقة تمر على الشوارع
   بالترتيب من -1580 صعوداً، وكل شارع يستهلك
   نحو 120 شجرة. فسقف 420 كان ينفد على أول
   ثلاثة أو أربعة شوارع فقط — أي في الركن
   البعيد من الخريطة — ولا تبقى شجرة واحدة
   قرب نقطة البداية في المنتصف.

   الحل: نحسب كل المواضع الممكنة في المدينة
   أولاً، ثم نأخذ موضعاً واحداً كل TREE_STRIDE
   ليتوزع نفس العدد على كل الشوارع.
*/

let treeCandidateTotal=0;

for(
    const line
    of cityRoadLines
){

    const lineSpacing=
        line.type==="main"
        ?52
        :74;

    treeCandidateTotal+=
        Math.floor(
            (CONFIG.CITY_HALF*2-60)/
            lineSpacing
        )*2;
}


const TREE_STRIDE=
    Math.max(
        1,
        Math.floor(
            treeCandidateTotal/
            CONFIG.MAX_TREES
        )
    );


let treeSlot=0;


/*
   نمر على كل شارع في الشبكة ونضع
   الزينة على جانبيه.
*/

for(
    const line
    of cityRoadLines
){

    if(
        treeCount>=CONFIG.MAX_TREES &&
        buildingCount>=CONFIG.MAX_BUILDINGS
    )
        break;


    const half=
        CONFIG.CITY_HALF;

    const isAvenue=
        line.type==="main";


    /* تباعد الزينة على طول الشارع */

    const spacing=
        isAvenue
        ?52
        :74;


    for(
        let t=-half+30;
        t<half-30;
        t+=spacing
    ){

        for(
            const side
            of [-1,1]
        ){

            /* مسافة الشجرة من محور الشارع */

            const treeOffset=
                line.width*.5+
                5+
                Math.random()*4;

            const tx=
                line.axis==="z"
                ?line.coord+side*treeOffset
                :t;

            const tz=
                line.axis==="z"
                ?t
                :line.coord+side*treeOffset;


            const takeTree=
                (treeSlot++ % TREE_STRIDE)===0;


            if(
                takeTree &&
                treeCount<CONFIG.MAX_TREES &&
                validDecorationPosition(tx,tz,4.5)
            ){

                addTree(

                    tx+(Math.random()-.5)*2.5,

                    tz+(Math.random()-.5)*2.5,

                    .75+Math.random()*.5

                );

                treeCount++;
            }


            /*
               المباني أبعد قليلاً، وداخل
               البلوك بين الشوارع.
            */

            if(
                !isAvenue ||
                Math.random()>.55
            )
                continue;


            const buildOffset=
                line.width*.5+
                22+
                Math.random()*16;

            const bx=
                line.axis==="z"
                ?line.coord+side*buildOffset
                :t+(Math.random()-.5)*20;

            const bz=
                line.axis==="z"
                ?t+(Math.random()-.5)*20
                :line.coord+side*buildOffset;


            if(
                buildingCount<CONFIG.MAX_BUILDINGS &&
                validDecorationPosition(bx,bz,13)
            ){

                addBuilding(

                    bx,

                    bz,

                    .7+Math.random()*.45

                );

                buildingCount++;
            }
        }
    }
}


/*
   =========================================================
   منازل الشوارع الفرعية (الجانبية)
   كل 150م منزل على الجانبين، بعشوائية بسيطة
   في الموضع والحجم، لكن دائماً موجودة —
   لها سقف مستقل حتى لا تُحرمها مباني الجادات.
   =========================================================
*/

let sideHouseCount=0;


for(
    const line
    of cityRoadLines
){

    if(line.type==="main")
        continue;

    if(sideHouseCount>=CONFIG.MAX_SIDE_HOUSES)
        break;


    const half=
        CONFIG.CITY_HALF;

    const houseSpacing=150;


    for(
        let t=-half+35;
        t<half-35;
        t+=houseSpacing
    ){

        for(
            const side
            of [-1,1]
        ){

            if(sideHouseCount>=CONFIG.MAX_SIDE_HOUSES)
                break;


            const jitterAlong=
                (Math.random()-.5)*18;

            const houseOffset=
                line.width*.5+
                9+
                Math.random()*10;

            const hx=
                line.axis==="z"
                ?line.coord+side*houseOffset
                :t+jitterAlong;

            const hz=
                line.axis==="z"
                ?t+jitterAlong
                :line.coord+side*houseOffset;


            if(
                validDecorationPosition(hx,hz,11)
            ){

                addBuilding(

                    hx,

                    hz,

                    .55+Math.random()*.35

                );

                sideHouseCount++;
            }
        }
    }
}


/*
   =========================================================
   منازل على جانبي الجادات الرئيسية (الشوارع الكبيرة)
   كل 150م منزل على الجانبين، بنفس أسلوب
   الشوارع الفرعية، وبسقف مستقل مضمون —
   هذا يضمن وجود منازل على الشارع الرئيسي
   (بما فيه الجادة الوسطى المُستعادة).
   =========================================================
*/

let avenueHouseCount=0;


for(
    const line
    of cityRoadLines
){

    if(line.type!=="main")
        continue;

    if(avenueHouseCount>=CONFIG.MAX_AVENUE_HOUSES)
        break;


    const half=
        CONFIG.CITY_HALF;

    const houseSpacing=150;


    for(
        let t=-half+35;
        t<half-35;
        t+=houseSpacing
    ){

        for(
            const side
            of [-1,1]
        ){

            if(avenueHouseCount>=CONFIG.MAX_AVENUE_HOUSES)
                break;


            const jitterAlong=
                (Math.random()-.5)*18;

            const houseOffset=
                line.width*.5+
                12+
                Math.random()*12;

            const hx=
                line.axis==="z"
                ?line.coord+side*houseOffset
                :t+jitterAlong;

            const hz=
                line.axis==="z"
                ?t+jitterAlong
                :line.coord+side*houseOffset;


            if(
                validDecorationPosition(hx,hz,13)
            ){

                addBuilding(

                    hx,

                    hz,

                    .65+Math.random()*.4

                );

                avenueHouseCount++;
            }
        }
    }
}


/* =========================================================
   ROADSIDE LIGHTS
========================================================= */
const lampPoleMat = new THREE.MeshStandardMaterial({color:0x30353a,metalness:.7,roughness:.35});
const lampGlowMat = new THREE.MeshBasicMaterial({color:0xffe6a0,transparent:true,opacity:.9});
function addLamp(x,z,side){
    const g=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,4.2,8),lampPoleMat);
    pole.position.y=2.1; g.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.8,.08,.08),lampPoleMat);
    arm.position.set(side*.38,4.1,0); g.add(arm);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),lampGlowMat);
    bulb.position.set(side*.72,4.02,0); g.add(bulb);
    g.position.set(x,0,z); scene.add(g);
}

/* أعمدة إنارة على الجادات الرئيسية فقط */

for(
    const line
    of cityRoadLines
){

    if(line.type!=="main")
        continue;


    const half=
        CONFIG.CITY_HALF;

    const offset=
        line.width*.5+3.2;


    for(
        let t=-half+60;
        t<half-60;
        t+=150
    ){

        for(
            const side
            of [-1,1]
        ){

            const lx=
                line.axis==="z"
                ?line.coord+side*offset
                :t;

            const lz=
                line.axis==="z"
                ?t
                :line.coord+side*offset;


            addLamp(lx,lz,side);
        }
    }
}

/* =========================================================
   PEOPLE
========================================================= */

const people=[];


/* =========================================================
   ADD PERSON
========================================================= */

function addPerson(
    x,
    z
){

    const personScale=.9+Math.random()*.15;
    const person=
        personTemplate
        ? cloneGLBForUse(personTemplate,"person",personScale,2.1)
        : createFallbackPerson();

    if(!person) return;

    prepareModel(person,"person");
    if(!personTemplate){
        person.userData.modelType="fallback-person";
        person.scale.multiplyScalar(personScale);
    }


    person.position.set(
        x,
        0,
        z
    );


    placeOnGround(person);

    scene.add(person);


    const walker={

        object:person,

        baseX:x,

        baseZ:z,

        phase:
            Math.random()*
            Math.PI*2,

        speed:
            .35+
            Math.random()*1.35,

        direction:
            Math.random()<.5
            ?-1
            :1,

        pauseTimer:
            Math.random()*4,

        pauseChance:
            .1+
            Math.random()*.25,

        moving:true,

        angle:
            Math.random()*
            Math.PI*2,

        changeTimer:
            1+
            Math.random()*5,

        dead:false,

        panic:false,

        panicTimer:0,

        panicSpeed:0,

        panicAngle:0,

        passenger:false,

        missionPassenger:false,

        targetX:x,

        targetZ:z

    };


    people.push(walker);

    return walker;
}


/* =========================================================
   CREATE PEOPLE
========================================================= */

/*
   نوزع المارة على أرصفة كل شوارع المدينة،
   لا على الجادة الوسطى وحدها.
*/

for(
    let i=0;
    i<CONFIG.MAX_PEOPLE;
    i++
){

    let placed=false;


    for(
        let attempt=0;
        attempt<12 && !placed;
        attempt++
    ){

        const line=
            cityRoadLines[
                Math.floor(
                    Math.random()*cityRoadLines.length
                )
            ];

        const half=
            CONFIG.CITY_HALF;

        const t=
            -half+30+
            Math.random()*(half*2-60);

        const side=
            Math.random()<.5
            ?-1
            :1;

        const offset=
            line.width*.5+
            2.5+
            Math.random()*3;


        const x=
            line.axis==="z"
            ?line.coord+side*offset
            :t;

        const z=
            line.axis==="z"
            ?t
            :line.coord+side*offset;


        if(
            validDecorationPosition(x,z,2.2)
        ){

            addPerson(x,z);

            placed=true;
        }
    }
}


/* =========================================================
   MISSION SYSTEM
========================================================= */

let coins=0;

let mission=null;


/*
   إيجاد شخص حي بعيد قليلاً عن السيارة.
*/

function findMissionPassenger(){

    const candidates=[];


    for(
        const p
        of people
    ){

        if(p.dead)
            continue;

        if(p.passenger)
            continue;

        const dx=
            p.object.position.x-
            car.position.x;

        const dz=
            p.object.position.z-
            car.position.z;

        const d=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        /*
           لا نختار شخصاً
           بعيداً جداً.
        */

        if(
            d>1500
        )
            continue;


        candidates.push(p);
    }


    if(!candidates.length)
        return null;


    return candidates[
        Math.floor(
            Math.random()*
            candidates.length
        )
    ];
}


/*
   إنشاء مهمة جديدة.
*/

function createMission(){

    const passenger=
        findMissionPassenger();


    if(!passenger){

        mission=null;

        return;
    }


    /*
       وجهة داخل حدود المدينة، على أحد
       شوارع الشبكة وليس على خط مستقيم واحد.
    */

    const half=
        CONFIG.CITY_HALF;

    let destinationX=0;
    let destinationZ=0;

    let best=-1;


    for(
        let attempt=0;
        attempt<16;
        attempt++
    ){

        const line=
            cityRoadLines[
                Math.floor(
                    Math.random()*cityRoadLines.length
                )
            ];

        const t=
            -half+40+
            Math.random()*(half*2-80);

        const cx=
            line.axis==="z"
            ?line.coord
            :t;

        const cz=
            line.axis==="z"
            ?t
            :line.coord;


        const dx=cx-passenger.baseX;
        const dz=cz-passenger.baseZ;

        const d=
            Math.sqrt(dx*dx+dz*dz);


        /* نفضّل وجهة متوسطة البعد */

        if(
            d>180 &&
            (best<0 || d<best)
        ){

            best=d;

            destinationX=cx;

            destinationZ=cz;
        }
    }


    if(best<0){

        destinationX=0;

        destinationZ=
            Math.max(
                -half+60,
                Math.min(
                    half-60,
                    passenger.baseZ+300
                )
            );
    }


    passenger.missionPassenger=true;


    mission={

        passenger:passenger,

        destinationX:destinationX,

        destinationZ:destinationZ,

        state:"pickup",

        reward:10,

        completed:false

    };


    showMissionMessage(
        "🎯 مهمة جديدة: أوصل الراكب لتحصل على 10 🪙"
    );
}


/* =========================================================
   MISSION HUD
========================================================= */

function updateMissionHUD(){

    const text=
        document.getElementById(
            "missionText"
        );

    const distance=
        document.getElementById(
            "missionDistance"
        );


    if(!mission){

        text.textContent=
            "لا توجد مهمة حالياً.";

        distance.textContent=
            "--";

        return;
    }


    const passenger=
        mission.passenger;


    if(
        mission.state===
        "pickup"
    ){

        text.textContent=
            "اذهب إلى الشخص المحدد والتقطه.";

        const dx=
            passenger.object.position.x-
            car.position.x;

        const dz=
            passenger.object.position.z-
            car.position.z;

        const d=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        distance.textContent=
            "📍 الراكب: "+
            Math.round(d)+
            " متر";

    }
    else if(
        mission.state===
        "delivery"
    ){

        text.textContent=
            "الراكب معك. أوصله إلى الوجهة.";

        const dx=
            mission.destinationX-
            car.position.x;

        const dz=
            mission.destinationZ-
            car.position.z;

        const d=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        distance.textContent=
            "📍 الوجهة: "+
            Math.round(d)+
            " متر";

    }
    else if(
        mission.state===
        "completed"
    ){

        text.textContent=
            "تم إنجاز المهمة بنجاح!";

        distance.textContent=
            "🎉 +10 عملات ذهبية";

    }
}


/* =========================================================
   PICKUP MISSION
========================================================= */

function updateMission(dt){

    if(!mission)
        return;


    const passenger=
        mission.passenger;


    /*
       إذا مات الراكب قبل إكمال المهمة
       تفشل المهمة.
    */

    if(
        passenger.dead
    ){

        mission.state="failed";

        showMissionMessage(
            "❌ فشلت المهمة: الراكب مات."
        );

        passenger.missionPassenger=false;

        setTimeout(
            function(){

                if(
                    mission &&
                    mission.state==="failed"
                ){

                    createMission();
                }

            },
            3500
        );

        return;
    }


    if(
        mission.state===
        "pickup"
    ){

        const dx=
            passenger.object.position.x-
            car.position.x;

        const dz=
            passenger.object.position.z-
            car.position.z;

        const d=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        if(
            d<=CONFIG.PICKUP_DISTANCE &&
            Math.abs(speed)<8
        ){

            passenger.passenger=true;

            passenger.missionPassenger=true;

            passenger.object.visible=false;

            mission.state="delivery";


            showMissionMessage(
                "👤 صعد الراكب! توجه إلى الوجهة 📍"
            );
        }
    }


    else if(
        mission.state===
        "delivery"
    ){

        const dx=
            mission.destinationX-
            car.position.x;

        const dz=
            mission.destinationZ-
            car.position.z;

        const d=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        if(
            d<=CONFIG.DELIVERY_DISTANCE &&
            Math.abs(speed)<8
        ){

            mission.state="completed";

            mission.completed=true;


            coins+=10;


            document.getElementById(
                "coins"
            ).textContent=
                coins;


            showMissionMessage(
                "🎉 وصلت الراكب! +10 🪙"
            );


            passenger.passenger=false;

            passenger.missionPassenger=false;


            /*
               إعادة الشخص إلى العالم
               عند نقطة الوجهة.
            */

            passenger.baseX=
                mission.destinationX+
                8;

            passenger.baseZ=
                mission.destinationZ;


            passenger.object.position.set(

                passenger.baseX,

                passenger.object.position.y,

                passenger.baseZ

            );


            passenger.object.visible=true;


            setTimeout(
                function(){

                    if(
                        mission &&
                        mission.completed
                    ){

                        createMission();
                    }

                },
                3000
            );
        }
    }


    updateMissionHUD();
}


/* =========================================================
   MISSION MARKER
========================================================= */

const missionMarker=
    new THREE.Group();


const markerMaterial=
    new THREE.MeshBasicMaterial({

        color:0xffd21f

    });


const markerTop=
    new THREE.Mesh(

        new THREE.ConeGeometry(
            .7,
            1.8,
            8
        ),

        markerMaterial

    );


markerTop.position.y=
    2.8;


missionMarker.add(
    markerTop
);


const markerRing=
    new THREE.Mesh(

        new THREE.TorusGeometry(
            2,
            .14,
            8,
            24
        ),

        markerMaterial

    );


markerRing.rotation.x=
    Math.PI/2;

markerRing.position.y=.08;

missionMarker.add(
    markerRing
);


missionMarker.visible=false;

scene.add(
    missionMarker
);


/* =========================================================
   UPDATE MARKER
========================================================= */

function updateMissionMarker(){

    if(!mission){

        missionMarker.visible=false;

        return;
    }


    if(
        mission.state==="pickup"
    ){

        missionMarker.visible=true;

        missionMarker.position.set(

            mission.passenger.object.position.x,

            0,

            mission.passenger.object.position.z

        );
    }

    else if(
        mission.state==="delivery"
    ){

        missionMarker.visible=true;

        missionMarker.position.set(

            mission.destinationX,

            0,

            mission.destinationZ

        );
    }

    else{

        missionMarker.visible=false;
    }


    markerTop.rotation.y+=.025;
}


/* =========================================================
   PEOPLE MOVEMENT
========================================================= */

function updatePeople(dt){

    for(
        const p
        of people
    ){

        if(
            p.dead ||
            p.passenger
        )
            continue;


        /*
           الهروب
        */

        if(
            p.panic
        ){

            p.panicTimer-=dt;


            p.baseX +=
                Math.cos(
                    p.panicAngle
                )*
                p.panicSpeed*
                dt;


            p.baseZ +=
                Math.sin(
                    p.panicAngle
                )*
                p.panicSpeed*
                dt;


            p.phase +=
                dt*
                8;


            /*
               حركة هروب أسرع.
            */

            if(
                p.object.userData.walkParts
            ){

                const parts=
                    p.object.userData.walkParts;

                const walk=
                    Math.sin(
                        p.phase*3
                    );


                parts.legs[0]
                    .rotation.x=
                    walk*.9;

                parts.legs[1]
                    .rotation.x=
                    -walk*.9;

                parts.arms[0]
                    .rotation.x=
                    -walk*.8;

                parts.arms[1]
                    .rotation.x=
                    walk*.8;
            }


            p.object.rotation.y=
                -p.panicAngle;


            p.object.position.x=
                p.baseX;

            p.object.position.z=
                p.baseZ;


            if(
                p.panicTimer<=0
            ){

                p.panic=false;

                p.changeTimer=
                    1+
                    Math.random()*4;
            }


            continue;
        }


        p.phase +=
            dt*
            (
                .8+
                p.speed
            );


        p.changeTimer-=dt;


        if(
            p.changeTimer<=0
        ){

            p.changeTimer=
                2+
                Math.random()*7;


            p.speed=
                .25+
                Math.random()*1.6;


            if(
                Math.random()<.4
            ){

                p.direction*=-1;
            }


            if(
                Math.random()<
                p.pauseChance
            ){

                p.pauseTimer=
                    .5+
                    Math.random()*4;
            }
        }


        if(
            p.pauseTimer>0
        ){

            p.pauseTimer-=dt;

            p.moving=false;

        }
        else{

            p.moving=true;
        }


        if(
            p.moving
        ){

            p.baseZ +=
                p.direction*
                p.speed*
                dt;


            p.baseX +=
                Math.sin(
                    p.phase*.37
                )*
                dt*.25;


            const road=
                nearestRoad(
                    p.baseX,
                    p.baseZ
                );


            if(
                road.distance<4
            ){

                p.baseX +=
                    (
                        p.baseX-
                        road.x
                    )*.02;
            }
        }


        p.object.position.x=
            p.baseX+
            Math.sin(
                p.phase*.51
            )*.3;


        p.object.position.z=
            p.baseZ;


        if(
            p.object.userData.walkParts
        ){

            const parts=
                p.object.userData.walkParts;


            const walk=
                p.moving
                ?
                Math.sin(
                    p.phase*3
                )
                :
                0;


            parts.legs[0]
                .rotation.x=
                walk*.65;


            parts.legs[1]
                .rotation.x=
                -walk*.65;


            parts.arms[0]
                .rotation.x=
                -walk*.5;


            parts.arms[1]
                .rotation.x=
                walk*.5;
        }


        if(
            p.moving
        ){

            p.object.rotation.y=
                p.direction>0
                ?
                Math.PI
                :
                0;
        }
    }
}


/* =========================================================
   PANIC PEOPLE
========================================================= */

function panicNearbyPeople(
    impactX,
    impactZ
){

    for(
        const p
        of people
    ){

        if(
            p.dead ||
            p.passenger
        )
            continue;


        const dx=
            p.object.position.x-
            impactX;

        const dz=
            p.object.position.z-
            impactZ;

        const distance=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        if(
            distance>
            CONFIG.PANIC_RADIUS
        )
            continue;


        /*
           اتجاه الهروب من السيارة
           مع عشوائية حتى لا يتحركوا
           كلهم بنفس الطريقة.
        */

        let angle=
            Math.atan2(
                dz,
                dx
            );


        angle+=
            (
                Math.random()-.5
            )*
            1.35;


        p.panic=true;

        p.panicAngle=angle;

        p.panicSpeed=
            CONFIG.PANIC_SPEED_MIN+
            Math.random()*
            (
                CONFIG.PANIC_SPEED_MAX-
                CONFIG.PANIC_SPEED_MIN
            );

        p.panicTimer=
            CONFIG.PANIC_TIME_MIN+
            Math.random()*
            (
                CONFIG.PANIC_TIME_MAX-
                CONFIG.PANIC_TIME_MIN
            );


        p.pauseTimer=0;

    }
}


/* =========================================================
   PERSON DEATH
========================================================= */

function killPerson(
    person,
    impactX,
    impactZ
){

    if(
        person.dead
    )
        return;


    person.dead=true;

    person.panic=false;

    person.moving=false;


    /*
       إذا كان الشخص راكب المهمة
       تفشل المهمة.
    */

    if(
        person.missionPassenger &&
        mission
    ){

        mission.state="failed";

        showMissionMessage(
            "❌ فشلت المهمة: الراكب مات."
        );
    }


    /*
       سقوط الجسم.
    */

    person.object.rotation.z=
        Math.PI*.48;

    person.object.rotation.x=
        .12;


    /*
       إخفاء تدريجي لاحقاً.
    */

    setTimeout(
        function(){

            if(
                person.dead
            ){

                person.object.visible=false;
            }

        },
        3500
    );


    /*
       الناس القريبون يهربون.
    */

    panicNearbyPeople(
        impactX,
        impactZ
    );


    playPersonImpactSound();


    showMissionMessage(
        "⚠️ حدث اصطدام! الناس القريبون يهربون."
    );


    flashImpact();
}


/* =========================================================
   INPUT
========================================================= */

const input={

    forward:false,

    backward:false,

    left:false,

    right:false

};


function bindControl(
    id,
    property
){

    const element=
        document.getElementById(id);


    element.addEventListener(
        "pointerdown",
        function(e){

            e.preventDefault();

            startAudio();

            input[property]=true;

            element.classList.add(
                "active"
            );
        }
    );


    function release(e){

        if(e)
            e.preventDefault();

        input[property]=false;

        element.classList.remove(
            "active"
        );
    }


    element.addEventListener(
        "pointerup",
        release
    );


    element.addEventListener(
        "pointercancel",
        release
    );


    element.addEventListener(
        "pointerleave",
        release
    );
}


bindControl(
    "forward",
    "forward"
);


bindControl(
    "backward",
    "backward"
);


bindControl(
    "left",
    "left"
);


bindControl(
    "right",
    "right"
);


/* =========================================================
   KEYBOARD
========================================================= */

window.addEventListener(
    "keydown",
    function(e){

        startAudio();


        if(
            e.key==="ArrowUp"||
            e.key==="w"||
            e.key==="W"
        )
            input.forward=true;


        if(
            e.key==="ArrowDown"||
            e.key==="s"||
            e.key==="S"
        )
            input.backward=true;


        if(
            e.key==="ArrowLeft"||
            e.key==="a"||
            e.key==="A"
        )
            input.left=true;


        if(
            e.key==="ArrowRight"||
            e.key==="d"||
            e.key==="D"
        )
            input.right=true;

    }
);


window.addEventListener(
    "keyup",
    function(e){

        if(
            e.key==="ArrowUp"||
            e.key==="w"||
            e.key==="W"
        )
            input.forward=false;


        if(
            e.key==="ArrowDown"||
            e.key==="s"||
            e.key==="S"
        )
            input.backward=false;


        if(
            e.key==="ArrowLeft"||
            e.key==="a"||
            e.key==="A"
        )
            input.left=false;


        if(
            e.key==="ArrowRight"||
            e.key==="d"||
            e.key==="D"
        )
            input.right=false;

    }
);


/* =========================================================
   PHYSICS
========================================================= */

let speed=0;

let heading=0;


function updatePhysics(dt){

    /*
       أمام
    */

    if(
        input.forward
    ){

        /*
           إذا كنت ترجع للخلف
           نوقف الرجوع أولاً.
        */

        if(
            speed<0
        ){

            speed+=
                CONFIG.BRAKE*
                dt;

            if(
                speed>0
            )
                speed=0;

        }
        else{

            speed+=
                CONFIG.ACCELERATION*
                dt;
        }
    }


    /*
       خلف
    */

    else if(
        input.backward
    ){

        /*
           إذا كنت تتحرك للأمام
           يعمل كفرامل.
        */

        if(
            speed>0
        ){

            speed-=
                CONFIG.BRAKE*
                dt;

            if(
                speed<0
            )
                speed=0;

        }
        else{

            speed-=
                CONFIG.ACCELERATION*
                .55*
                dt;
        }
    }


    /*
       بدون دعس
    */

    else{

        if(
            speed>0
        ){

            speed=
                Math.max(
                    0,
                    speed-
                    CONFIG.FRICTION*
                    dt
                );

        }
        else if(
            speed<0
        ){

            speed=
                Math.min(
                    0,
                    speed+
                    CONFIG.FRICTION*
                    dt
                );
        }
    }


    speed=
        Math.max(

            -CONFIG.MAX_REVERSE,

            Math.min(
                CONFIG.MAX_SPEED,
                speed
            )

        );


    /*
       STEERING
    */

    if(
        Math.abs(speed)>.15
    ){

        const ratio=
            Math.min(
                Math.abs(speed)/
                CONFIG.STEER_REFERENCE_SPEED,
                1
            );


        const steering=
            CONFIG.STEERING*
            (
                .3+
                ratio*.7
            );


        const direction=
            speed>=0
            ?1
            :-1;


        if(
            input.left
        ){

            heading+=
                steering*
                dt*
                direction;
        }


        if(
            input.right
        ){

            heading-=
                steering*
                dt*
                direction;
        }
    }


    car.rotation.y=
        heading;


    /*
       السبب الجذري للعكس السابق: كانت
       السيارة تتحرك نحو -Z المحلي بينما
       الكاميرا تنظر نحو +Z، فبدا زر "أمام"
       وكأنه يرجع بالسيارة. الآن الحركة
       بنفس اتجاه نظر الكاميرا.
    */

    car.translateZ(
        speed*dt
    );


    /*
       حدود المدينة: نمنع الخروج
       خارج مساحة الـ 10 كم².
    */

    const cityLimit=
        CONFIG.CITY_HALF-6;


    if(car.position.x>cityLimit){
        car.position.x=cityLimit;
        speed*=.4;
    }

    if(car.position.x<-cityLimit){
        car.position.x=-cityLimit;
        speed*=.4;
    }

    if(car.position.z>cityLimit){
        car.position.z=cityLimit;
        speed*=.4;
    }

    if(car.position.z<-cityLimit){
        car.position.z=-cityLimit;
        speed*=.4;
    }


    /*
       تثبيت السيارة فوق الأرض.
    */

    car.position.y=
        carGroundY;


    /*
       الاحتكاك خارج الطريق.
    */

    const road=
        nearestRoad(
            car.position.x,
            car.position.z
        );


    const allowed=
        road.width/2;


    if(
        road.distance>
        allowed
    ){

        speed*=
            Math.pow(
                .52,
                dt
            );
    }


    checkCollision(dt);
}


/* =========================================================
   COLLISION
========================================================= */

let collisionCooldown=0;


function checkCollision(dt){

    for(
        const item
        of collisionObjects
    ){

        const dx=
            car.position.x-
            item.object.position.x;

        const dz=
            car.position.z-
            item.object.position.z;

        const distance=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        const carRadius=1.35;

        const required=
            carRadius+
            item.radius;


        if(
            distance<
            required
        ){

            const nx=
                distance>0
                ?
                dx/distance
                :
                1;

            const nz=
                distance>0
                ?
                dz/distance
                :
                0;


            const push=
                required-
                distance;


            car.position.x+=
                nx*push;

            car.position.z+=
                nz*push;


            if(
                item.type==="person"
            ){

                speed*=.08;

            }
            else{

                speed*=-.22;
            }


            if(
                collisionCooldown<=0
            ){

                playCollisionSound();

                collisionCooldown=.45;
            }
        }
    }


    /*
       فحص الأشخاص منفصل.
    */

    for(
        const person
        of people
    ){

        if(
            person.dead ||
            person.passenger
        )
            continue;


        const dx=
            car.position.x-
            person.object.position.x;

        const dz=
            car.position.z-
            person.object.position.z;

        const distance=
            Math.sqrt(
                dx*dx+
                dz*dz
            );


        /*
           لا نقتل شخصاً
           من مجرد الاقتراب البعيد.
        */

        if(
            distance<2.35 &&
            Math.abs(speed)>2
        ){

            killPerson(
                person,
                person.object.position.x,
                person.object.position.z
            );


            /*
               ارتداد السيارة.
            */

            speed*=-.14;
        }
    }


    collisionCooldown=
        Math.max(
            0,
            collisionCooldown-dt
        );
}


/* =========================================================
   AUDIO
========================================================= */

let audioContext=null;

let engineOsc=null;

let engineGain=null;

let engineFilter=null;

let audioStarted=false;


function startAudio(){

    if(audioStarted){

        if(
            audioContext &&
            audioContext.state==="suspended"
        ){

            audioContext.resume();
        }

        return;
    }


    try{

        const AudioContextClass=
            window.AudioContext||
            window.webkitAudioContext;


        if(!AudioContextClass)
            return;


        audioContext=
            new AudioContextClass();


        engineOsc=
            audioContext.createOscillator();

        engineGain=
            audioContext.createGain();

        engineFilter=
            audioContext.createBiquadFilter();


        engineOsc.type=
            "sawtooth";


        engineOsc.frequency.value=
            65;


        engineFilter.type=
            "lowpass";


        engineFilter.frequency.value=
            800;


        engineGain.gain.value=
            .0001;


        engineOsc.connect(
            engineFilter
        );

        engineFilter.connect(
            engineGain
        );

        engineGain.connect(
            audioContext.destination
        );


        engineOsc.start();

        audioStarted=true;


        document.getElementById(
            "soundHint"
        ).style.opacity="0";

    }
    catch(error){

        console.log(
            "Audio unavailable"
        );
    }
}


/* =========================================================
   ENGINE AUDIO
========================================================= */

function updateAudio(){

    if(!audioStarted)
        return;


    if(
        audioContext.state==="suspended"
    ){

        audioContext.resume();
    }


    const ratio=
        Math.min(
            Math.abs(speed)/
            CONFIG.MAX_SPEED,
            1
        );


    engineOsc.frequency.value=
        58+
        ratio*175+
        (
            input.forward
            ?
            32
            :
            0
        );


    engineFilter.frequency.value=
        500+
        ratio*1700;


    engineGain.gain.value=
        .012+
        ratio*.035+
        (
            input.forward
            ?
            .016
            :
            0
        );
}


/* =========================================================
   COLLISION SOUND
========================================================= */

function playCollisionSound(){

    if(!audioStarted)
        return;


    try{

        const oscillator=
            audioContext.createOscillator();

        const gain=
            audioContext.createGain();


        oscillator.type=
            "square";

        oscillator.frequency.value=
            90;


        gain.gain.setValueAtTime(
            .07,
            audioContext.currentTime
        );


        gain.gain.exponentialRampToValueAtTime(

            .0001,

            audioContext.currentTime+.16

        );


        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );


        oscillator.start();

        oscillator.stop(
            audioContext.currentTime+.16
        );

    }
    catch(e){}
}


/* =========================================================
   PERSON IMPACT SOUND
========================================================= */

function playPersonImpactSound(){

    if(!audioStarted)
        return;


    try{

        const oscillator=
            audioContext.createOscillator();

        const gain=
            audioContext.createGain();


        oscillator.type=
            "triangle";


        oscillator.frequency.setValueAtTime(
            180,
            audioContext.currentTime
        );


        oscillator.frequency.exponentialRampToValueAtTime(
            65,
            audioContext.currentTime+.28
        );


        gain.gain.setValueAtTime(
            .09,
            audioContext.currentTime
        );


        gain.gain.exponentialRampToValueAtTime(
            .0001,
            audioContext.currentTime+.28
        );


        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );


        oscillator.start();

        oscillator.stop(
            audioContext.currentTime+.28
        );

    }
    catch(e){}
}


/* =========================================================
   IMPACT FLASH
========================================================= */

function flashImpact(){

    const flash=
        document.getElementById(
            "impactFlash"
        );


    flash.style.opacity="1";


    setTimeout(
        function(){

            flash.style.transition=
                "opacity .45s";

            flash.style.opacity="0";

        },
        40
    );


    setTimeout(
        function(){

            flash.style.transition=
                "";

        },
        550
    );
}


/* =========================================================
   MESSAGE
========================================================= */

let messageTimer=null;


function showMissionMessage(
    text
){

    const element=
        document.getElementById(
            "missionMessage"
        );


    element.textContent=text;

    element.classList.add(
        "show"
    );


    clearTimeout(
        messageTimer
    );


    messageTimer=
        setTimeout(
            function(){

                element.classList.remove(
                    "show"
                );

            },
            2600
        );
}


/* =========================================================
   CAMERA
========================================================= */

const cameraTarget=
    new THREE.Vector3();

const desiredCamera=
    new THREE.Vector3();

const cameraOffset=
    new THREE.Vector3();

const UP_AXIS=
    new THREE.Vector3(
        0,
        1,
        0
    );


/*
   مسافة الكاميرا خلف السيارة — ثابتة دائماً
   ولا تتغير مع السرعة إطلاقاً.
*/
const CAMERA_DISTANCE=5;

const CAMERA_HEIGHT=3.3;


function updateCamera(dt){

    /*
       وضع المقود: يسار = +1، يمين = -1.
       الدوران الموجب حول Z يبدو عكس عقارب
       الساعة للسائق، أي لفّاً نحو اليسار —
       فيتطابق الاتجاهان تلقائياً.
    */

    const steerTarget=
        (input.left?1:0)+
        (input.right?-1:0);


    steerVisual+=
        (steerTarget-steerVisual)*
        Math.min(
            1,
            dt*6
        );


    if(wheelSpin)
        wheelSpin.rotation.z=
            steerVisual*
            WHEEL_MAX_TURN;


    if(wheelRig)
        wheelRig.visible=interiorView;


    if(interiorView){

        desiredCamera.copy(
            DRIVER_EYE
        );

        desiredCamera.applyAxisAngle(
            UP_AXIS,
            heading
        );

        desiredCamera.add(
            car.position
        );

        camera.position.copy(
            desiredCamera
        );


        cameraTarget.set(
            0,
            1.05,
            10
        );

        cameraTarget.applyAxisAngle(
            UP_AXIS,
            heading
        );

        cameraTarget.add(
            car.position
        );

        camera.lookAt(
            cameraTarget
        );

        return;
    }


    desiredCamera.set(
        0,
        CAMERA_HEIGHT,
        -CAMERA_DISTANCE
    );


    desiredCamera.applyAxisAngle(
        UP_AXIS,
        heading
    );


    desiredCamera.add(
        car.position
    );


    const smooth=
        1-
        Math.pow(
            .001,
            dt
        );


    camera.position.lerp(
        desiredCamera,
        smooth
    );


    /*
       كان التنعيم يُطبَّق على الموضع كاملاً،
       فتتخلّف الكاميرا عن السيارة كلما زادت
       السرعة وتبدو كأنها تبتعد.
       الآن يبقى التنعيم للدوران فقط، ثم
       تُعاد المسافة الأفقية إلى قيمتها
       الثابتة في كل إطار، فلا تبتعد الكاميرا
       أبداً مهما بلغت السرعة.
    */

    cameraOffset.copy(
        camera.position
    ).sub(
        car.position
    );

    cameraOffset.y=0;


    if(
        cameraOffset.lengthSq()<1e-6
    ){

        cameraOffset.set(
            0,
            0,
            -1
        ).applyAxisAngle(
            UP_AXIS,
            heading
        );
    }


    cameraOffset.setLength(
        CAMERA_DISTANCE
    );


    camera.position.set(

        car.position.x+
        cameraOffset.x,

        car.position.y+
        CAMERA_HEIGHT,

        car.position.z+
        cameraOffset.z

    );


    cameraTarget.set(
        0,
        1.25,
        7
    );


    cameraTarget.applyAxisAngle(
        UP_AXIS,
        heading
    );


    cameraTarget.add(
        car.position
    );


    camera.lookAt(
        cameraTarget
    );
}


/* =========================================================
   MAP
========================================================= */

const mapContainer=
    document.getElementById(
        "mapContainer"
    );


const mapCanvas=
    document.getElementById(
        "miniMap"
    );


const mapContext=
    mapCanvas.getContext(
        "2d"
    );


let mapExpanded=false;


mapContainer.addEventListener(
    "pointerdown",
    function(e){

        e.preventDefault();

        startAudio();

        mapExpanded=
            !mapExpanded;


        if(mapExpanded){

            mapContainer.classList.add(
                "full"
            );

            document.getElementById(
                "mapTitle"
            ).textContent=
                "اضغط لإغلاق الخريطة";

        }
        else{

            mapContainer.classList.remove(
                "full"
            );

            document.getElementById(
                "mapTitle"
            ).textContent=
                "اضغط للخريطة";
        }
    }
);


/* =========================================================
   MAP DRAW
========================================================= */

function drawMap(){

    const width=
        mapCanvas.width;

    const height=
        mapCanvas.height;


    mapContext.clearRect(
        0,
        0,
        width,
        height
    );


    mapContext.fillStyle=
        "#102219";


    mapContext.fillRect(
        0,
        0,
        width,
        height
    );


    const range=
        mapExpanded
        ?
        1200
        :
        300;


    const scale=
        width/
        (
            range*2
        );


    function convert(
        x,
        z
    ){

        return {

            x:
                width/2+
                (
                    x-
                    car.position.x
                )*
                scale,

            y:
                height/2-
                (
                    z-
                    car.position.z
                )*
                scale

        };
    }


    /*
       grid
    */

    mapContext.strokeStyle=
        "rgba(255,255,255,.05)";

    mapContext.lineWidth=1;


    const gridStep=
        mapExpanded
        ?
        100
        :
        50;


    for(
        let i=-range;
        i<=range;
        i+=gridStep
    ){

        const a=
            convert(
                car.position.x+i,
                car.position.z-range
            );


        const b=
            convert(
                car.position.x+i,
                car.position.z+range
            );


        mapContext.beginPath();

        mapContext.moveTo(
            a.x,
            a.y
        );

        mapContext.lineTo(
            b.x,
            b.y
        );

        mapContext.stroke();


        const c=
            convert(
                car.position.x-range,
                car.position.z+i
            );


        const d=
            convert(
                car.position.x+range,
                car.position.z+i
            );


        mapContext.beginPath();

        mapContext.moveTo(
            c.x,
            c.y
        );

        mapContext.lineTo(
            d.x,
            d.y
        );

        mapContext.stroke();
    }


    /*
       roads
    */

    for(
        const road
        of roads
    ){

        mapContext.beginPath();

        let started=false;


        mapContext.lineWidth=
            road.type==="main"
            ?
            (
                mapExpanded
                ?8
                :6
            )
            :
            (
                mapExpanded
                ?6
                :4
            );


        mapContext.strokeStyle=
            road.type==="main"
            ?
            "#8d8d8d"
            :
            "#686868";


        for(
            const p
            of road.points
        ){

            if(
                Math.abs(
                    p.z-
                    car.position.z
                )>
                range
            )
                continue;


            const q=
                convert(
                    p.x,
                    p.z
                );


            if(!started){

                mapContext.moveTo(
                    q.x,
                    q.y
                );

                started=true;

            }
            else{

                mapContext.lineTo(
                    q.x,
                    q.y
                );
            }
        }


        if(started)
            mapContext.stroke();
    }


    /*
       mission
    */

    if(
        mission &&
        (
            mission.state==="pickup"||
            mission.state==="delivery"
        )
    ){

        const mx=
            mission.state==="pickup"
            ?
            mission.passenger.object.position.x
            :
            mission.destinationX;


        const mz=
            mission.state==="pickup"
            ?
            mission.passenger.object.position.z
            :
            mission.destinationZ;


        const m=
            convert(
                mx,
                mz
            );


        if(
            m.x>-20 &&
            m.x<width+20 &&
            m.y>-20 &&
            m.y<height+20
        ){

            mapContext.fillStyle=
                "#ffd21f";

            mapContext.beginPath();

            mapContext.arc(
                m.x,
                m.y,
                mapExpanded
                ?8
                :6,
                0,
                Math.PI*2
            );

            mapContext.fill();


            mapContext.strokeStyle=
                "#fff";

            mapContext.lineWidth=2;

            mapContext.stroke();
        }
    }


    /*
       people
    */

    if(mapExpanded){

        for(
            const p
            of people
        ){

            if(
                p.dead ||
                p.passenger
            )
                continue;


            const q=
                convert(
                    p.object.position.x,
                    p.object.position.z
                );


            if(
                q.x>=0 &&
                q.x<=width &&
                q.y>=0 &&
                q.y<=height
            ){

                mapContext.fillStyle=
                    p.panic
                    ?
                    "#ff6633"
                    :
                    "#5fe3ff";


                mapContext.beginPath();

                mapContext.arc(
                    q.x,
                    q.y,
                    2.5,
                    0,
                    Math.PI*2
                );

                mapContext.fill();
            }
        }
    }


    /*
       car
    */

    const cx=
        width/2;

    const cy=
        height/2;


    mapContext.save();


    mapContext.translate(
        cx,
        cy
    );


    mapContext.rotate(
        heading
    );


    mapContext.fillStyle=
        "#ff3030";


    mapContext.beginPath();


    mapContext.moveTo(
        0,
        -13
    );

    mapContext.lineTo(
        8,
        10
    );

    mapContext.lineTo(
        0,
        6
    );

    mapContext.lineTo(
        -8,
        10
    );

    mapContext.closePath();

    mapContext.fill();


    mapContext.strokeStyle=
        "#ffffff";

    mapContext.lineWidth=2;

    mapContext.stroke();


    mapContext.restore();


    if(mapExpanded){

        mapContext.strokeStyle=
            "rgba(255,255,255,.25)";

        mapContext.lineWidth=2;

        mapContext.beginPath();

        mapContext.arc(
            cx,
            cy,
            28,
            0,
            Math.PI*2
        );

        mapContext.stroke();
    }
}


/* =========================================================
   RESET
========================================================= */

document
.getElementById("reset")
.addEventListener(
    "click",
    function(){

        startAudio();


        car.position.x=
            mainRoadX(0);

        car.position.z=0;

        car.position.y=
            carGroundY;


        speed=0;

        heading=0;

        car.rotation.y=0;


        /*
           إعادة الأشخاص الموتى.
        */

        for(
            const p
            of people
        ){

            if(
                p.dead
            ){

                p.dead=false;

                p.panic=false;

                p.object.visible=true;

                p.object.rotation.set(
                    0,
                    0,
                    0
                );
            }
        }


        for(const p of people){
            p.passenger=false;
            p.missionPassenger=false;
        }

        mission=null;
        coins=0;

        document.getElementById(
            "coins"
        ).textContent=
            coins;

        createMission();
        updateMissionHUD();
    }
);


/* =========================================================
   HUD
========================================================= */

function updateHUD(){

    document.getElementById(
        "speed"
    ).textContent=
        Math.round(
            Math.abs(speed)*3.6
        );


    document.getElementById(
        "gear"
    ).textContent=
        speed<-.2
        ?
        "R"
        :
        "D";


    document.getElementById(
        "coins"
    ).textContent=
        coins;
}


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    function(){

        camera.aspect=
            window.innerWidth/
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);


/* =========================================================
   LOADING
========================================================= */

let loadingProgress=5;


const loadingTimer=
    setInterval(
        function(){

            loadingProgress+=
                8+
                Math.random()*10;


            if(
                loadingProgress>100
            )
                loadingProgress=100;


            document.getElementById(
                "loadingFill"
            ).style.width=
                loadingProgress+
                "%";


            document.getElementById(
                "loadingPercent"
            ).textContent=
                Math.round(
                    loadingProgress
                )+
                "%";


            if(
                loadingProgress>=100
            ){

                clearInterval(
                    loadingTimer
                );


                document.getElementById(
                    "loadingTitle"
                ).textContent=
                    "المدينة جاهزة 🚗";


                setTimeout(
                    function(){

                        document.getElementById(
                            "loading"
                        ).style.display=
                            "none";

                    },
                    400
                );
            }

        },
        160
    );


/* =========================================================
   START MISSION
========================================================= */

setTimeout(
    function(){

        createMission();

        updateMissionHUD();

    },
    1000
);


/* =========================================================
   MAIN LOOP
========================================================= */

const clock=
    new THREE.Clock();


let mapTimer=0;


function animate(){

    requestAnimationFrame(
        animate
    );


    const dt=
        Math.min(
            clock.getDelta(),
            .04
        );


    updatePhysics(dt);

    updateGrassField();

    updatePeople(dt);

    updateMission(dt);

    updateMissionMarker();

    updateAudio();

    updateCamera(dt);

    updateHUD();


    mapTimer+=dt;


    if(
        mapTimer>.12
    ){

        drawMap();

        mapTimer=0;
    }


    sun.position.set(

        car.position.x-35,

        /*
           يبقى الضوء مرتفعاً رغم انخفاض القرص،
           وإلا صارت الظلال طويلة جداً. الاتجاه
           الأفقي واحد في الاثنين.
        */
        100,

        car.position.z+130

    );


    /*
       القبة السماوية كانت ثابتة عند نقطة
       الأصل، فبمجرد ابتعاد السيارة عن
       المركز كانت تخرج منها ويظهر "جدار"
       بلون السماء. الآن تتبع السيارة دائماً.
    */

    sky.position.set(
        car.position.x,
        0,
        car.position.z
    );


    sun.target.position.copy(
        car.position
    );


    updateSunModel();


    dust.rotation.y += dt*.004;

    markerRing.scale.setScalar(1 + Math.sin(performance.now()*.006)*.08);

    renderer.render(
        scene,
        camera
    );
}


/* =========================================================
   INITIAL MAP
========================================================= */

drawMap();


/* =========================================================
   START
========================================================= */

animate();


})();

