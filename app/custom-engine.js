/*
* Comunicacion para toda la apliacion con Socket.io
* Todas las paginas pueden hacer uso de estos sockets
*/

var moment = require('moment-timezone');
var mysql = require('mysql');
var promiseMysql = require('promise-mysql');
var dbconfig = require('../config/database');
const utf8 = require('utf8');

var promisePool = promiseMysql.createPool(dbconfig.connection);
promisePool.query('USE ' + dbconfig.database);

var fs = require('fs')
  , Log = require('log')
  , log = new Log('debug', fs.createWriteStream('../logs/engine.log'));

// Util para cuando se crea una nueva conexion en el pool
promisePool.on('connection', function () {
    console.log("Se creo una conexion al pool")
//connection.query('SET SESSION auto_increment_increment=1') // TODO: ver si es necesario ponerle esto
});


// El pool emite un evento cuando una conexion es regresada al pool de conexiones para ser utilizada por otra conexion
promisePool.on('release', function () {
    console.log('Connection released');
});

// ver cuando se adquirio una connexion del pool de conexiones
promisePool.on('acquire', function () {
    console.log('Connection acquired');
});


// define constructor function that gets `io` send to it
module.exports = function(io) {
    // When a client connects, we note it in the console
    io.sockets.on('connection', function (socket) {
        console.log('A client is connected!');
        socket.emit('message', 'alive');
        socket.emit('conectado', 'se conecto una tablet') // Hay que ver como casar la sesion para mandar el status de una sola tablet a la pagina web.
        
        // When the server receives a “message” type signal from the client   
        // Solo de prueba, esta parte tiene que ser eliminada al final
        socket.on('message', function (message) {
            socket.emit('message', 'alive');
            console.log('A client is speaking to me! They’re saying: ' + message);
        });

        // Peticion de la configuracion de cada laptop
        // TODO: no mandarle el activo a jossie
        socket.on('config', function (message) {

            console.log('Peticion de configuración')

            if (message == "all"){
                
                var return_data = {}
                promisePool.getConnection().then(function(connection) {

                    // TODO: Hay que agregar que se mande el metodo para reiniciar el contador
                    connection.query("select * from turnos where activo = true").then(function(rows){
                        return_data.turnos = rows
                        
                        var result = connection.query("select * from plantas where active = true")
                        return result
                    }).then(function(rows){
                        return_data.plantas = rows
                        
                        var result = connection.query("select * from areas where active = true")
                        return result
                    }).then(function(rows){
                        return_data.areas = rows
                        
                        var result = connection.query("select * from maquinas where active = true")
                        return result
                    }).then(function(rows){
                        return_data.maquinas = rows
                        
                        // TODO: validar si funciona.
                        var result = connection.query("select * from razones_calidad where activo = true and id not in (1)")
                        return result
                    }).then(function(rows){
                        return_data.razones_calidad = rows
                        
                        // TODO: validar si funciona.
                        var result = connection.query("select * from razones_paro where active = true and id not in (1,200,201)")
                        return result
                    }).then(function(rows) {
                        return_data.razones_paro = rows

                        // Suelta la conexion ejemplo: Connection 404 released
                        //connection.release();
                        // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                        promisePool.releaseConnection(connection);
                        
                        // Se separan los datos obtenidos de los queries

                        console.log(return_data)

                        var plantas = return_data.plantas
                        var areas = return_data.areas
                        var maquinas = return_data.maquinas
                        var razones_paro =return_data.razones_paro
                        var razones_calidad = return_data.razones_calidad
                        var turnos = return_data.turnos
        
                        // Objeto donde se va a guardar toda la confirguacion.
                        var json = {plantas : []}
        
                        for (var x = 0; x<plantas.length; x++){
                            planta = plantas[x]
                            json.plantas.push({"nombre": planta.nombre, "id": planta.id, "areas": [], "turnos": []}) // Se agrega un objeto con el nombre de cada planta y area (2do nivel)
        
                            for (var y = 0; y<areas.length; y++){ // Se recorren todas las areas
                                area = areas[y]
        
                                if (area.plantas_id == planta.id){ // Si el area le pertenece a la planta en turno
                                    json.plantas[x].areas.push({"nombre":area.nombre, "id": area.id, maquinas: []}) // Se agrega el area a la planta en turno (3er nivel)
        
                                    for (var z = 0; z<maquinas.length; z++){ // Se recorren todas las maquinas
                                        var maquina = maquinas[z]
        
                                        if (maquina.areas_id == area.id) // Si la maquina pertenece al area en turno
                                        {
                                            json.plantas[x].areas[y].maquinas.push({"nombre": maquina.nombre, "id":maquina.id, razones: [], calidad: [] }) // Se agrega la maquina al area en turno (4to nivel)
        
                                            for (var a = 0; a<razones_paro.length; a++){ // Se recorren todas las razones de paro
                                                var razon_paro = razones_paro[a]
        
                                                if (razon_paro.maquinas_id == maquina.id){ // Si la razon de paro pertenece a la maquina en turno 
                                                    //json.plantas[x].areas[y].maquinas[z].razones.push(razon_paro.nombre) // Se agrega la razon de paro a la maquina en turno (5to nivel)
                                                    json.plantas[x].areas[y].maquinas[z].razones.push({"nombre": razon_paro.nombre, "id":razon_paro.id }) // Se agrega la razon de paro a la maquina en turno (5to nivel)
                                                }
                                            }

                                            for (var a = 0; a<razones_calidad.length; a++){ // Se recorren todas las razones de calidad
                                                var razon_calidad = razones_calidad[a]
        
                                                if (razon_calidad.maquinas_id == maquina.id){ // Si la razon de paro pertenece a la maquina en turno 
                                                    //json.plantas[x].areas[y].maquinas[z].razones.push(razon_calidad.nombre) // Se agrega la razon de paro a la maquina en turno (5to nivel)
                                                    json.plantas[x].areas[y].maquinas[z].calidad.push({"nombre": razon_calidad.nombre, "id":razon_calidad.id }) // Se agrega la razon de paro a la maquina en turno (5to nivel)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            for (var b = 0; b<turnos.length; b++){
                                turno = turnos[b]
        
                                if (turno.plantas_id == planta.id){
                                    json.plantas[x].turnos.push({"nombre": turno.nombre, "inicio":turno.inicio, "fin":turno.fin})
                                }
                            }
                        }

                        // Anterior emit ---- se guarda para pruebas solamente
                        //io.emit('config', '{"plantas": [{"planta": "Planta1-Chihuahua-Nave1", "areas": [{"nombre": "area 1", "maquinas": [{"nombre": "area1-maquina-1", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area1-maquina-2", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area1-maquina-3", "razones": ["razon 1", "razon 2", "razon 3"] } ] }, {"nombre": "area 2", "maquinas": [{"nombre": "area2-maquina-1", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area2-maquina-2", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area2-maquina-3", "razones": ["razon 1", "razon 2", "razon 3"] } ] } ], "turnos": [{"nombre": "primera", "inicio": "06:00", "fin": "15:00"}, {"nombre": "segunda", "inicio": "15:00", "fin": "21:00"}, {"nombre": "tercera", "inicio": "21:00", "fin": "06:00"} ] }, {"planta": "Planta1-Chihuahua-Nave2", "areas": [{"nombre": "area 1", "maquinas": [{"nombre": "area1-maquina-1", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area1-maquina-2", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area1-maquina-3", "razones": ["razon 1", "razon 2", "razon 3"] } ] }, {"nombre": "area 2", "maquinas": [{"nombre": "area2-maquina-1", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area2-maquina-2", "razones": ["razon 1", "razon 2", "razon 3"] }, {"nombre": "area2-maquina-3", "razones": ["razon 1", "razon 2", "razon 3"] } ] } ], "turnos": [{"nombre": "primera", "inicio": "06:00", "fin": "15:00"}, {"nombre": "segunda", "inicio": "15:00", "fin": "21:00"}, {"nombre": "tercera", "inicio": "21:00", "fin": "06:00"} ] } ] }'); // io.emit send a message to everione connected
                        log.info('Se envio la configuración')
                        io.emit('config', utf8.encode(JSON.stringify(json)));
                    }).catch(function(err) {
                       log.error('Error al obtener la configuración: ' + err)
                       //log.error(err)
                    });
                });
            }
        });

        // TODO: hacer digital1 & 2 y contador
        //socket.on('digital1', function (message) {
        //    console.log(message)
        //});


        // TODO: Hay que hacer otro evento donde se guarde la calidad (hay que hablar esto con Jossie para ver si es posible o si utilizamos es mismo)
        socket.on('evento', function (message) {

            log.info('Evento Recibido' + message)
            var evento = JSON.parse(message);

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
            hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
            
            // TODO: La hora siempre me da error, las horas siempre me dan sin minutos,,,,, hay que ver como solucionarlo
                
            promisePool.getConnection().then(function(connection) {
                
                connection.query("select * from razones_paro where id = " + evento.razones_id).then(function(rows){

                    // TODO: de momento va a estar hardcodeado el productos_id pero hay que arreglar esta parte
                    var save  = {
                        operacion_uuid: evento.operacion_uuid, 
                        activo: evento.activo, 
                        tiempo: evento.tiempo, 
                        fecha: fecha, 
                        hora: hora, 
                        plantas_id: evento.planta_id,
                        areas_id: evento.area_id,
                        maquinas_id: evento.maquina_id,
                        productos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajadoproductos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajado
                        razones_paro_id: evento.razones_id,
                        razones_calidad_id: 1 // Se guarda 1 (Pieza buena) porque aqui vamos a medir TA/TM solamente pero el campo es not null TODO: Mejorar esto
                    };

                    console.log(save);

                    var result = connection.query("INSERT INTO eventos2 SET ?", save)
                    
                    // TODO: Confirmar que se guardo la info ?
                    return result
                }).then(function(rows){

                    // Suelta la conexion ejemplo: Connection 404 released
                    //connection.release();
                    // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                    promisePool.releaseConnection(connection);

                    //return_data.plantas = rows
                    // TODO: Aqui hay que mandar la actualizacion del pedo a todos.... Hay que hacer los queries o todo lo necesario para actualizar
                    // o llamar a algo mas que lo haga
                    // TODO: probar si funciona mandarse un evento a si mismo (server-server)
                    //socket.emit('actualizar', return_data);
                    log.info('Se guardo el evento')
                    socket.emit('evento-done', evento.operacion_uuid);


                    var return_data = {}
                    promisePool.getConnection().then(function(connection) {

                        log.info('Preparando la actualización para enviarla')
                        // TODO: hay que hacer 
                        // TODO: Agregar algunas funciones para que no varie el timezone... (convertirlo)
                        var d = new Date()
                        var h = d.getHours()
                        var m = d.getMinutes()
                        var s = d.getSeconds()
                        var horaActual = h + ":" + m + ":" + s
        
                        fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
                        hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                        
                        var where = " WHERE "
                        // TODO: Si no hay turnos, todos los siguientes queries dan undefined. Hay que comprobar que el turno actual es valido antes de hacer todo esto
                        // TODO: Hacer algo!!! -> Se muestra la ultima informacion guardada en la DB (activo/inactivo) Pero de eso pudo haber pasado mucho rato si no se ha agregado un cambio nuevo (necesitare agregar algo que verifique el ultimo estatus?????)
                        // Turno actual, nos va a servir para obtener la informacion del turno en cuestion
                        // TODO: agregar el problema con el turno de tercera, si esta de noche este query no me da resultados (empty set) y no me muestra la pagina
                        // TODO: El query tiene que ser contra turnos que esten activos. Activo = true
                        connection.query("SELECT * \
                        FROM turnos \
                        CROSS JOIN (SELECT CAST('" + hora + "' as time) AS evento) sub \
                        WHERE \
                            CASE WHEN inicio <= fin THEN inicio <= evento AND fin >= evento \
                            ELSE inicio <= evento OR fin >= evento END \
                        AND activo = 1;").then(function(rows){
                            return_data.turnoActual = rows

                            
                            if (return_data.turnoActual[0].inicio < return_data.turnoActual[0].fin) {
                                where += "e.fecha = CAST('" + fecha + "' as date) and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time) "
                            } else {
                                if (hora >= return_data.turnoActual[0].inicio) {
                                    where += "e.fecha = CAST('" + fecha + "' as date) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) "
                                } else {
                                    where += "(e.fecha = DATE_SUB(CAST('" + fecha + "' as date), INTERVAL 1 DAY) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time)) \
                                    OR (e.fecha = CAST('" + fecha + "' as date) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time)) "
                                }
                            }
                            
                            // TA, TM, Disponibillidad Real, Sin disponibilidad Meta. Agrupado por maquina
                            // TODO: A todos los queries hay que quitar los enters y \ porque traducidos se ven asi select e.maquinas_id maquina, \t\t\t\tsum(e.valor) piezas, \t\t\t\tsum(e.tiempo) tiempo, \t\t\t\tsum(e.valor)...
                            var result = connection.query("select maquinas_id, \
                            sum(case when activo=1 then tiempo else 0 end) ta, \
                            sum(case when activo=0 then tiempo else 0 end) tm, \
                            (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                            from eventos2 e \
                            " + where + " \
                            group by maquinas_id") 
                            return result
                        }).then(function(rows){
                            return_data.disponibilidad = rows
                            // TODO: Agrer el active = 1 a todos estos queries para evitar informacion inutil
                            // Informacion agrupada por maquina (id del eventos2, activo, razon, producto, maquina)
                            var result = connection.query("select e1.id as id, \
                            e1.maquinas_id as maquina, \
                            m.nombre as nombre, \
                            r.nombre as razon, \
                            p.nombre as producto, \
                            e1.razones_paro_id, \
                            e1.productos_id, \
                            e1.activo, \
                            (concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora)) fecha_y_hora_evento, \
                            (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second)) fecha_y_hora_del_evento_mas_60_segundos, \
                            (CONVERT_TZ(now(),'+00:00','America/Chihuahua')) Hora_actual, \
                            (case when (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second) >= (CONVERT_TZ(now(),'+00:00','America/Chihuahua'))) then 'online' else  'offline' end) status \
                            from eventos2 as e1 \
                            INNER JOIN ( \
                              select maquinas_id, MAX(id) as id \
                              from eventos2 \
                              where activo is not NULL \
                              group by maquinas_id) as e2 \
                            on e1.id = e2.id \
                            inner join razones_paro r on e1.razones_paro_id = r.id \
                            inner join productos p on e1.productos_id = p.id \
                            inner join maquinas m on e1.maquinas_id = m.id")  // TODO: Ver si conviene agregar al query de estado una fecha y hora en el where
                                
                            return result
                        }).then(function(rows){ 
                            return_data.estado = rows
                            // TODO: Estos queries cuando no regresan filas en el template ejs me aparece como undefined y no se despliega un buen resultado
                            // Rendimiento agrupado por maquina
                            var result = connection.query("select maquina, sum(piezas) piezas, sum(tiempo) tiempo, sum(realidad)/count(*) 'real', sum(rendimiento)/count(*) rendimiento from \
                            (select e.maquinas_id maquina, p.id, \
                            sum(e.valor) piezas, \
                            sum(e.tiempo) tiempo, \
                            sum(e.valor)/(sum(e.tiempo)/60/60) realidad, \
                            ((sum(e.valor)/(sum(e.tiempo)/60/60))/p.rendimiento)*100 rendimiento \
                            from eventos2 e \
                            inner join productos p on e.productos_id = p.id \
                            " + where + " \
                            group by p.id, e.maquinas_id) sub \
                            group by maquina") 
                            return result
                        }).then(function(rows){ 
                            return_data.rendimiento = rows
            
                            // Calidad agrupada por maquina
                            var result = connection.query("select maquina, sum(pt) pt, sum(scrap) scrap, sum(total) total, sum(calidad_real)/count(*) calidad_real, sum(calidad)/count(*) calidad from \
                            (select e.maquinas_id maquina, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) pt, \
                            sum(case when e.razones_calidad_id > 1 then e.valor else 0 end) scrap, \
                            sum(e.valor) total, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) calidad_real, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) / p.calidad calidad \
                            from eventos2 e \
                            inner join productos p on e.productos_id = p.id \
                            " + where + " \
                            group by p.calidad, e.maquinas_id) sub \
                            group by maquina")
        
                            return result
                        }).then(function(rows) {
                            return_data.calidad = rows
        
                            // Suelta la conexion ejemplo: Connection 404 released
                            //connection.release();
                            // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                            promisePool.releaseConnection(connection);
            
                            log.info('Se envio la actualización a todos los clientes conectados')
                            // Boradcast emite un mensaje a todos menos al que lo mando a llamar
                            socket.broadcast.emit('actualizar', utf8.encode(JSON.stringify(return_data)));
        
                        }).catch(function(err) {
                           log.error(" Error al enviar la actualización" + err)
                        });
                    });
                    //socket.broadcast.emit('estado-actual', evento)

                }).catch(function(err) {
                   log.error("Error al guardar el evento" + err)
                });
            });


        });

        // When the server receives a “config” type signal from the client   
        socket.on('actualizar', function (message) {
            
            log.info('Inicia - socket on actualizar')

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
            hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')


            var return_data = {}
            promisePool.getConnection().then(function(connection) {
    

                var where = " WHERE "
                // TODO: Si no hay turnos, todos los siguientes queries dan undefined. Hay que comprobar que el turno actual es valido antes de hacer todo esto
                // TODO: Hacer algo!!! -> Se muestra la ultima informacion guardada en la DB (activo/inactivo) Pero de eso pudo haber pasado mucho rato si no se ha agregado un cambio nuevo (necesitare agregar algo que verifique el ultimo estatus?????)
                // Turno actual, nos va a servir para obtener la informacion del turno en cuestion
                // TODO: agregar el problema con el turno de tercera, si esta de noche este query no me da resultados (empty set) y no me muestra la pagina
                // TODO: El query tiene que ser contra turnos que esten activos. Activo = true
                connection.query("SELECT * \
                FROM turnos \
                CROSS JOIN (SELECT CAST('" + hora + "' as time) AS evento) sub \
                WHERE \
                    CASE WHEN inicio <= fin THEN inicio <= evento AND fin >= evento \
                    ELSE inicio <= evento OR fin >= evento END \
                AND activo = 1;").then(function(rows){
                    return_data.turnoActual = rows

                    
                    if (return_data.turnoActual[0].inicio < return_data.turnoActual[0].fin) {
                            where += "e.fecha = CAST('" + fecha + "' as date) and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time) "
                    } else {
                        if (hora >= return_data.turnoActual[0].inicio) {
                            where += "e.fecha = CAST('" + fecha + "' as date) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) "
                        } else {
                            where += "(e.fecha = DATE_SUB(CAST('" + fecha + "' as date), INTERVAL 1 DAY) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time)) \
                            OR (e.fecha = CAST('" + fecha + "' as date) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time)) "
                        }
                    }
                    
                    // TA, TM, Disponibillidad Real, Sin disponibilidad Meta. Agrupado por maquina
                    // TODO: A todos los queries hay que quitar los enters y \ porque traducidos se ven asi select e.maquinas_id maquina, \t\t\t\tsum(e.valor) piezas, \t\t\t\tsum(e.tiempo) tiempo, \t\t\t\tsum(e.valor)...
                    var result = connection.query("select maquinas_id, \
                    sum(case when activo=1 then tiempo else 0 end) ta, \
                    sum(case when activo=0 then tiempo else 0 end) tm, \
                    (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                    from eventos2 e \
                    " + where + " \
                    group by maquinas_id") 
                    return result
                }).then(function(rows){
                    return_data.disponibilidad = rows
                    // TODO: Agrer el active = 1 a todos estos queries para evitar informacion inutil
                    // Informacion agrupada por maquina (id del eventos2, activo, razon, producto, maquina)
                    var result = connection.query("select e1.id as id, \
                    e1.maquinas_id as maquina, \
                    m.nombre as nombre, \
                    r.nombre as razon, \
                    p.nombre as producto, \
                    e1.razones_paro_id, \
                    e1.productos_id, \
                    e1.activo, \
                    (concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora)) fecha_y_hora_evento, \
                    (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second)) fecha_y_hora_del_evento_mas_60_segundos, \
                    (CONVERT_TZ(now(),'+00:00','America/Chihuahua')) Hora_actual, \
                    (case when (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second) >= (CONVERT_TZ(now(),'+00:00','America/Chihuahua'))) then 'online' else  'offline' end) status \
                    from eventos2 as e1 \
                    INNER JOIN ( \
                      select maquinas_id, MAX(id) as id \
                      from eventos2 \
                      where activo is not NULL \
                      group by maquinas_id) as e2 \
                    on e1.id = e2.id \
                    inner join razones_paro r on e1.razones_paro_id = r.id \
                    inner join productos p on e1.productos_id = p.id \
                    inner join maquinas m on e1.maquinas_id = m.id")  // TODO: Ver si conviene agregar al query de estado una fecha y hora en el where
                        
                    return result
                }).then(function(rows){ 
                    return_data.estado = rows
                    // TODO: Estos queries cuando no regresan filas en el template ejs me aparece como undefined y no se despliega un buen resultado
                    // Rendimiento agrupado por maquina
                    var result = connection.query("select maquina, sum(piezas) piezas, sum(tiempo) tiempo, sum(realidad)/count(*) 'real', sum(rendimiento)/count(*) rendimiento from \
                    (select e.maquinas_id maquina, p.id, \
                    sum(e.valor) piezas, \
                    sum(e.tiempo) tiempo, \
                    sum(e.valor)/(sum(e.tiempo)/60/60) realidad, \
                    ((sum(e.valor)/(sum(e.tiempo)/60/60))/p.rendimiento)*100 rendimiento \
                    from eventos2 e \
                    inner join productos p on e.productos_id = p.id \
                    " + where + " \
                    group by p.id, e.maquinas_id) sub \
                    group by maquina") 
                    return result
                }).then(function(rows){ 
                    return_data.rendimiento = rows
    
                    // Calidad agrupada por maquina
                    var result = connection.query("select maquina, sum(pt) pt, sum(scrap) scrap, sum(total) total, sum(calidad_real)/count(*) calidad_real, sum(calidad)/count(*) calidad from \
                    (select e.maquinas_id maquina, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) pt, \
                    sum(case when e.razones_calidad_id > 1 then e.valor else 0 end) scrap, \
                    sum(e.valor) total, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) calidad_real, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) / p.calidad calidad \
                    from eventos2 e \
                    inner join productos p on e.productos_id = p.id \
                    " + where + " \
                    group by p.calidad, e.maquinas_id) sub \
                    group by maquina")

                    return result
                }).then(function(rows) {
                    return_data.calidad = rows

                    // Suelta la conexion ejemplo: Connection 404 released
                    //connection.release();
                    // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                    promisePool.releaseConnection(connection);
    
                    log.info('Termina - socket on actualizar')
                    // Boradcast emite un mensaje a todos menos al que lo mando a llamar
                    socket.emit('accounts',  utf8.encode(JSON.stringify(returnData)));
                    socket.emit('actualizar', utf8.encode(JSON.stringify(return_data)));

                }).catch(function(err) {
                   log.error("Error - socket on actualizar " + err)
                });
            });
        });

        // When the server receives a “config” type signal from the client   
        socket.on('register', function (message) {
            // TODO: Agregar el nombre del usuario que se conecto.
            socket.emit('register', 'ok');
        });

        socket.on('disconnect', (reason) => {
            // TODO: Detectar quien se desconecto y dejar de mandarle cosas a el
            socket.emit('desconectado', "se desconecto una tablet")
        });

        /*
        * Cambio de la planta seleccionada (Paginas que hacen reportes)
        */
        socket.on('cambio-planta', function (message) {
            
            var return_data = {}
            promisePool.getConnection().then(function(connection) {
                connection.query("select * from turnos where activo = true and plantas_id = " + message).then(function(rows){
                    return_data.turnos = rows
                    
                    var result = connection.query("select * from areas where active = true and plantas_id = " + message)
                    return result
                }).then(function(rows){
                    return_data.areas = rows
                    
                    var result = connection.query("select * from productos where activo = true and plantas_id = " + message)
                    return result
                }).then(function(rows) {
                    return_data.productos = rows

                    // Suelta la conexion ejemplo: Connection 404 released
                    //connection.release();
                    // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                    promisePool.releaseConnection(connection);

                    // TODO: Modificar este codigo para enviarselo solo al que lo pidio, estudiar mas el funcionamiento de los sockets
                    io.emit('cambio-planta', return_data); // io.emit send a message to everione connected

                }).catch(function(err) {
                   log.error(err)
                });
            });
        });

        socket.on('reporte-oee', function (json) {
            var planta = json.planta // all | id
            var area = json.area // all | id
            var turno = json.turno // id
            var productos = json.producto // TODO: solo recibe un producto, tiene que ser un arreglo.
            var inicio = json.inicio // YYYY-MM-DD
            var fin = json.fin // YYYY-MM-DD
            var horaInicio = json.horaInicio // Este valor es recibido en segundos.
            var horaFin = json.horaFin // Este valor es recibido en segundos.
            var tipo = json.tipo // hora | producto | turno.

            var where = " WHERE (e.fecha >= '" + inicio + "' AND e.fecha <= '" + fin + "') "

            // Si las planta no es "todas" se filtra tambien por planta ID
            if (planta != "all")
                where += "AND (e.plantas_id = " + planta + " ) "

            // Si el area no es "todas" se filtra tambien por area ID
            if (area != "all") 
                where += "AND (e.areas_id = " + area + " ) "

            var turnosQuery = ""
            if (tipo == "turno"){
                turnosQuery = "select * from turnos where (id = " + turno + " )" // Se agrega el turno ID al query // TODO: Hay que hacer algo para cuando el turno no existe
            } else {
                turnosQuery = "select * from turnos"
            }

            // TODO: Reporte OEE sigue utilizando CASE en el where, hay que cambiarlo
            // Si el tipo de reporte es por hora, se agrega la hora a la clausula where
            if (tipo == "hora") {
                where += "AND CASE WHEN SEC_TO_TIME(" + horaInicio + ") <= SEC_TO_TIME(" + horaFin + ") \
                          THEN e.hora >= SEC_TO_TIME(" + horaInicio + ") AND e.hora < SEC_TO_TIME(" + horaFin + ") \
                          ELSE (e.hora <= SEC_TO_TIME(" + horaInicio + ") AND e.hora <= SEC_TO_TIME(" + horaFin + ")) OR \
                               (e.hora >= SEC_TO_TIME(" + horaInicio + ") AND e.hora >= SEC_TO_TIME(" + horaFin + ")) END "
            }

            if (tipo == "producto")
                where += "AND (e.productos_id = " + productos + ") "

            // select * from eventos2 where concat(DATE_FORMAT(`fecha`, '%Y-%m-%d'),' ',`hora`) BETWEEN "2018-04-24 06:00" AND "2018-04-25 06:00"
            if (tipo == "six-to-six") {
                where = " where concat(DATE_FORMAT(e.fecha, '%Y-%m-%d'),' ',e.hora) BETWEEN '" + inicio + "06:00' AND '" + fin + "06:00'"
                console.log(where)
            }
            
                
            var return_data = {}
            promisePool.getConnection().then(function(connection) {
                
                var today = new Date();
                var dd = today.getDate();
                
                var mm = today.getMonth()+1; 
                var yyyy = today.getFullYear();
                if(dd<10) 
                    dd='0'+dd;
                
                if(mm<10) 
                    mm='0'+mm;
                
                today = yyyy+'-'+mm+'-'+dd;
        
                var d = new Date()
                var h = d.getHours()
                var m = d.getMinutes()
                var s = d.getSeconds()
                var horaActual = h + ":" + m + ":" + s
        
                fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
                hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                
        
                connection.query(turnosQuery)
                .then(function(rows){
                    return_data.turnoActual = rows

                    if (tipo == "turno"){
                        where += "AND CASE WHEN CAST('" + rows[0].inicio + "' as time) <= CAST('" +rows[0].fin + "' as time) \
                        THEN e.hora >= CAST('" + rows[0].inicio + "' as time) AND e.hora < CAST('" +rows[0].fin + "' as time) \
                        ELSE (e.hora <= CAST('" + rows[0].inicio + "' as time) AND e.hora <= CAST('" +rows[0].fin + "' as time)) OR \
                             (e.hora >= CAST('" + rows[0].inicio + "' as time) AND e.hora >= CAST('" +rows[0].fin + "' as time)) END "
                        
                    }
                    
                    // TODO: A todos estos queries hay que agregar la opcion para que vean el turno de 3ra para que no fallen
                    // TA, TM, Disponibillidad Real, Sin disponibilidad Meta. Agrupado por maquina
                    // TODO: A todos los queries hay que quitar los enters y \ porque traducidos se ven asi select e.maquinas_id maquina, \t\t\t\tsum(e.valor) piezas, \t\t\t\tsum(e.tiempo) tiempo, \t\t\t\tsum(e.valor)...
                    var result = connection.query("select maquinas_id, sum(case when activo=1 then tiempo else 0 end) ta, \
                    sum(case when activo=0 then tiempo else 0 end) tm, \
                    (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                    from eventos2 e " + where + " \
                    group by maquinas_id") 

                    console.log("select maquinas_id, sum(case when activo=1 then tiempo else 0 end) ta, \
                    sum(case when activo=0 then tiempo else 0 end) tm, \
                    (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                    from eventos2 e " + where + " \
                    group by maquinas_id")
                    
                    return result
                }).then(function(rows){ 
                    return_data.disponibilidad = rows
        
                    // Obtiene el desglose
                    var result = connection.query("SELECT sum(e.tiempo) 'tm', r.nombre 'nombre' FROM \
                        eventos2 e JOIN razones_paro r ON e.razones_paro_id = r.id" + where + "  and e.activo = false GROUP BY r.nombre ORDER BY tm desc")

                    return result
                }).then(function(rows){
                    return_data.desglose = rows

                    // TODO: A todos estos queries hay que hacerles lo mismo que el query de turnos, porque si no no va a mostrar bien el valor de el turno de 3ra
                    // TODO: este query solamente suma 
                    // Rendimiento agrupado por maquina

                    var result = connection.query("select maquina, sum(piezas) piezas, sum(tiempo) tiempo, sum(realidad)/count(*) 'real', sum(rendimiento)/count(*) rendimiento from \
                    (select e.maquinas_id maquina, p.id, \
                    sum(e.valor) piezas, \
                    sum(e.tiempo) tiempo, \
                    sum(e.valor)/(sum(e.tiempo)/60/60) realidad, \
                    ((sum(e.valor)/(sum(e.tiempo)/60/60))/p.rendimiento)*100 rendimiento \
                    from eventos2 e \
                    inner join productos p on e.productos_id = p.id \
                    " + where + " \
                    group by p.id, e.maquinas_id) sub \
                    group by maquina") 

                    return result
                }).then(function(rows){ 
                    return_data.rendimiento = rows
        
                    var result = connection.query("select maquina, sum(pt) pt, sum(scrap) scrap, sum(total) total, sum(calidad_real)/count(*) calidad_real, sum(calidad)/count(*) calidad from \
                    (select e.maquinas_id maquina, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) pt, \
                    sum(case when e.razones_calidad_id > 1 then e.valor else 0 end) scrap, \
                    sum(e.valor) total, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) calidad_real, \
                    sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) / p.calidad calidad \
                    from eventos2 e \
                    inner join productos p on e.productos_id = p.id \
                    " + where + " \
                    group by p.calidad, e.maquinas_id) sub \
                    group by maquina")
                    
                    return result
                }).then(function(rows) {
                    return_data.calidad = rows
        
                    // Suelta la conexion ejemplo: Connection 404 released
                    //connection.release();
                    // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                    promisePool.releaseConnection(connection);
        
                    // Emite el evento que es recibido por el cliente (que lo pidio?) para graficarlo TODO: Revisar esta parte del socket (quienes los reciben)
                    socket.emit('reporte-oee', return_data); // io.emit send a message to everione connected
                    
                    
                }).catch(function(err) {
                   log.error(err)
                    // TODO: Agregar que mande un error al socket cuando no se pudo obtener el resultado o ocurrio un error
                    
                });
            });
        })

        socket.on('digital1', function (message) {

            log.info('Digital 1 Recibido ' + message)
            var digital = JSON.parse(message);

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
			hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                
            promisePool.getConnection().then(function(connection) {

                var save  = {
                    fecha: fecha,
                    hora: hora,
                    activo: digital.valor, 
                    digital: 1
                };
                
                connection.query("INSERT INTO digital SET ?", save).then(function(rows){

                }).then(function(rows){

                    var result = connection.query("select d1.digital as digital, d1.activo as activo, d3.no_eventos \
                    from digital as d1 \
                    inner join (select max(id) as id, digital \
                      from digital \
                      group by digital) as d2 \
                    on d1.id = d2.id \
                    inner join (select count(*) no_eventos, digital from digital where activo = 0 group by digital) as d3 \
                    on d1.digital = d3.digital \
                    order by d1.digital")
                    
                    return result
                }).then(function(rows) {
                    message.rows = rows

                    promisePool.releaseConnection(connection);

                    socket.broadcast.emit('digital1', message);
                    log.info('Se guardo digital 1 en la DB')

                }).catch(function(err) {
                   log.error("error al guardar digital1 " + err)
                });
            });
        });

        socket.on('digital2', function (message) {

            log.info('Digital 2 recibido ' + message)

            var digital = JSON.parse(message);

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
            hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                
            promisePool.getConnection().then(function(connection) {

                var save  = {
                    fecha: fecha,
                    hora: hora,
                    activo: digital.valor, 
                    digital: 2
                };
                
                connection.query("INSERT INTO digital SET ?", save).then(function(rows){

                }).then(function(rows){

                    var result = connection.query("select d1.digital as digital, d1.activo as activo, d3.no_eventos \
                    from digital as d1 \
                    inner join (select max(id) as id, digital \
                      from digital \
                      group by digital) as d2 \
                    on d1.id = d2.id \
                    inner join (select count(*) no_eventos, digital from digital where activo = 0 group by digital) as d3 \
                    on d1.digital = d3.digital \
                    order by d1.digital")
                    
                    return result
                }).then(function(rows) {
                    message.rows = rows

                    promisePool.releaseConnection(connection);

                    socket.broadcast.emit('digital2', message);
                    log.info('Se guardo el digital 2 en la DB')

                }).catch(function(err) {
                   log.error("Error al guardar digital 2" + err)
                });
            });
        });

        socket.on('incremento1', function (message) {
            
            log.info('Incremento recibido: ' + message)

            var evento = JSON.parse(message);

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
			hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
            
            // Esta condicion hace que si son piezas malas las combierta de kgs a metros, 
            //if (evento.razon_calidad > 1) {
            //    evento.valor = evento.valor * 160.46213093709884467265725288832 // 6.232 = 1 km de cable
            //}

            promisePool.getConnection().then(function(connection) {
                
                connection.query("select 1 from dual").then(function(rows){

                    // Salva el incremento de piezas buenas o malas normalmente
                    var save  = {
                        operacion_uuid: 'incremento',  
                        fecha: fecha, 
                        hora: hora,
                        valor: evento.valor,
                        plantas_id: evento.planta_id,
                        areas_id: evento.area_id,
                        maquinas_id: evento.maquina_id,
                        productos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajadoproductos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajado
                        razones_paro_id: 1,
                        razones_calidad_id: evento.razon_calidad // Se guarda 1 (Pieza buena) porque aqui vamos a medir TA/TM solamente pero el campo es not null TODO: Mejorar esto
                    };

                    var result = connection.query("INSERT INTO eventos2 SET ?", save)

                    // Calculo no necesario, esto solo aplica para LEONI
                    // Esta condicion hace que si son piezas malas las combierta a metros, 
                    /*if (evento.razon_calidad > 1) {

                        evento.valor = pos_to_neg(evento.valor)

                        var save  = {
                            operacion_uuid: 'incremento',  
                            fecha: fecha, 
                            hora: hora,
                            valor: evento.valor,
                            plantas_id: evento.planta_id,
                            areas_id: evento.area_id,
                            maquinas_id: evento.maquina_id,
                            productos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajadoproductos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajado
                            razones_paro_id: 1,
                            //razones_calidad_id: 1 // Workaround para la aplicacion vieja
                            razones_calidad_id: 1 // Se guarda el decremento de las piezas
                        };
    
                        var result = connection.query("INSERT INTO eventos2 SET ?", save)
                    }*/

                    return result

                }).then(function(rows){

                    // Suelta la conexion ejemplo: Connection 404 released
                    //connection.release();
                    // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                    promisePool.releaseConnection(connection);

                    //return_data.plantas = rows
                    // TODO: Aqui hay que mandar la actualizacion del pedo a todos.... Hay que hacer los queries o todo lo necesario para actualizar
                    // o llamar a algo mas que lo haga
                    // TODO: probar si funciona mandarse un evento a si mismo (server-server)
                    //socket.emit('actualizar', return_data);
                    socket.emit('evento-done', evento.operacion_uuid);
                    log.info("Se guardo el incremento")


                    var return_data = {}
                    promisePool.getConnection().then(function(connection) {
                        // TODO: hay que hacer 
                        // TODO: Agregar algunas funciones para que no varie el timezone... (convertirlo)
                        var d = new Date()
                        var h = d.getHours()
                        var m = d.getMinutes()
                        var s = d.getSeconds()
                        var horaActual = h + ":" + m + ":" + s
                        console.log(horaActual)
        
                        fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
                        hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                        
                        var where = " WHERE "
                        // TODO: Si no hay turnos, todos los siguientes queries dan undefined. Hay que comprobar que el turno actual es valido antes de hacer todo esto
                        // TODO: Hacer algo!!! -> Se muestra la ultima informacion guardada en la DB (activo/inactivo) Pero de eso pudo haber pasado mucho rato si no se ha agregado un cambio nuevo (necesitare agregar algo que verifique el ultimo estatus?????)
                        // Turno actual, nos va a servir para obtener la informacion del turno en cuestion
                        // TODO: agregar el problema con el turno de tercera, si esta de noche este query no me da resultados (empty set) y no me muestra la pagina
                        // TODO: El query tiene que ser contra turnos que esten activos. Activo = true
                        connection.query("SELECT * \
                        FROM turnos \
                        CROSS JOIN (SELECT CAST('" + hora + "' as time) AS evento) sub \
                        WHERE \
                            CASE WHEN inicio <= fin THEN inicio <= evento AND fin >= evento \
                            ELSE inicio <= evento OR fin >= evento END \
                        AND activo = 1;").then(function(rows){
                            return_data.turnoActual = rows

                            
                            if (return_data.turnoActual[0].inicio < return_data.turnoActual[0].fin) {
                                    where += "e.fecha = CAST('" + fecha + "' as date) and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time) "
                            } else {
                                if (hora >= return_data.turnoActual[0].inicio) {
                                    where += "e.fecha = CAST('" + fecha + "' as date) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) "
                                } else {
                                    where += "(e.fecha = DATE_SUB(CAST('" + fecha + "' as date), INTERVAL 1 DAY) AND e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time)) \
                                    OR (e.fecha = CAST('" + fecha + "' as date) and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time)) "
                                }
                            }
                            
                            // TA, TM, Disponibillidad Real, Sin disponibilidad Meta. Agrupado por maquina
                            // TODO: A todos los queries hay que quitar los enters y \ porque traducidos se ven asi select e.maquinas_id maquina, \t\t\t\tsum(e.valor) piezas, \t\t\t\tsum(e.tiempo) tiempo, \t\t\t\tsum(e.valor)...
                            var result = connection.query("select maquinas_id, \
                            sum(case when activo=1 then tiempo else 0 end) ta, \
                            sum(case when activo=0 then tiempo else 0 end) tm, \
                            (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                            from eventos2 e \
                            " + where + " \
                            group by maquinas_id") 
                            return result
                        }).then(function(rows){
                            return_data.disponibilidad = rows
                            // TODO: Agrer el active = 1 a todos estos queries para evitar informacion inutil
                            // Informacion agrupada por maquina (id del eventos2, activo, razon, producto, maquina)
                            var result = connection.query("select e1.id as id, \
                            e1.maquinas_id as maquina, \
                            m.nombre as nombre, \
                            r.nombre as razon, \
                            p.nombre as producto, \
                            e1.razones_paro_id, \
                            e1.productos_id, \
                            e1.activo, \
                            (concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora)) fecha_y_hora_evento, \
                            (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second)) fecha_y_hora_del_evento_mas_60_segundos, \
                            (CONVERT_TZ(now(),'+00:00','America/Chihuahua')) Hora_actual, \
                            (case when (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL 60 second) >= (CONVERT_TZ(now(),'+00:00','America/Chihuahua'))) then 'online' else  'offline' end) status \
                            from eventos2 as e1 \
                            INNER JOIN ( \
                              select maquinas_id, MAX(id) as id \
                              from eventos2 \
                              where activo is not NULL \
                              group by maquinas_id) as e2 \
                            on e1.id = e2.id \
                            inner join razones_paro r on e1.razones_paro_id = r.id \
                            inner join productos p on e1.productos_id = p.id \
                            inner join maquinas m on e1.maquinas_id = m.id")  // TODO: Ver si conviene agregar al query de estado una fecha y hora en el where
                                
                            return result
                        }).then(function(rows){ 
                            return_data.estado = rows
                            // TODO: Estos queries cuando no regresan filas en el template ejs me aparece como undefined y no se despliega un buen resultado
                            // Rendimiento agrupado por maquina
                            var result = connection.query("select maquina, sum(piezas) piezas, sum(tiempo) tiempo, sum(realidad)/count(*) 'real', sum(rendimiento)/count(*) rendimiento from \
                            (select e.maquinas_id maquina, p.id, \
                            sum(e.valor) piezas, \
                            sum(e.tiempo) tiempo, \
                            sum(e.valor)/(sum(e.tiempo)/60/60) realidad, \
                            ((sum(e.valor)/(sum(e.tiempo)/60/60))/p.rendimiento)*100 rendimiento \
                            from eventos2 e \
                            inner join productos p on e.productos_id = p.id \
                            " + where + " \
                            group by p.id, e.maquinas_id) sub \
                            group by maquina") 
                            return result
                        }).then(function(rows){ 
                            return_data.rendimiento = rows
            
                            // Calidad agrupada por maquina
                            var result = connection.query("select maquina, sum(pt) pt, sum(scrap) scrap, sum(total) total, sum(calidad_real)/count(*) calidad_real, sum(calidad)/count(*) calidad from \
                            (select e.maquinas_id maquina, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) pt, \
                            sum(case when e.razones_calidad_id > 1 then e.valor else 0 end) scrap, \
                            sum(e.valor) total, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) calidad_real, \
                            sum(case when e.razones_calidad_id = 1 then e.valor else 0 end) * 100 / sum(e.valor) / p.calidad calidad \
                            from eventos2 e \
                            inner join productos p on e.productos_id = p.id \
                            " + where + " \
                            group by p.calidad, e.maquinas_id) sub \
                            group by maquina")
        
                            return result
                        }).then(function(rows) {
                            return_data.calidad = rows
        
                            // Suelta la conexion ejemplo: Connection 404 released
                            //connection.release();
                            // Parece que funciona igual al de arriba. Hay que probarlo en desarrollo
                            promisePool.releaseConnection(connection);

                            // Boradcast emite un mensaje a todos menos al que lo mando a llamar
                            socket.broadcast.emit('actualizar', return_data);
        
                        }).catch(function(err) {
                           log.error(err)
                        });
                    });
                    //socket.broadcast.emit('estado-actual', evento)

                }).catch(function(err) {
                   log.error(err)
                });
            });
        });

        // TODO: ver si se va a borrar este evento, ya que todos los incrementos (negativos y positivos) se reciben en el incremento 1
        socket.on('agregar-scrap', function (json) {

            log.info("Se recibio scrap " + json)
            var planta = json.planta // id
            var area = json.area // id
            var maquina = json.maquina // id
            var calidad = json.calidad // id
            var valor = json.valor // id

            //valor = valor * 160.46213093709884467265725288832 // 6.232 = 1 km de cable

            // 6.232 kgs = 1000 pzas
            // 1kgs      = 160.46213093709884467265725288832 pzas

            //console.log(planta + " " + area + " " + maquina + " " + valor);

            // Se obtiene fecha y hora
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
                dd='0'+dd;
            
            if(mm<10) 
                mm='0'+mm;

            today = yyyy+'-'+mm+'-'+dd;

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('YYYY-MM-DD')
            hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm:ss').tz('America/Chihuahua').format('HH:mm:ss')
                
            promisePool.getConnection().then(function(connection) {

                var save  = {
                    operacion_uuid: "scrap",
                    fecha: fecha, 
                    hora: hora, 
                    plantas_id: planta,
                    areas_id: area,
                    maquinas_id: maquina,
                    productos_id: 1, // TODO: valor hardcodeado, hay que obtener esta informacion segun lo que se este trabajando en la maquina actualmente
                    razones_paro_id: 1, // Maquina activa.... no importa como se guarde porque no va a traer tiempo asi que no afecta en los reportes/metricas
                    razones_calidad_id: calidad,
                    valor: valor  
                };
                
                connection.query("INSERT INTO eventos2 SET ?", save).then(function(rows){

                }).then(function(rows){

                    promisePool.releaseConnection(connection);

                    // Mandar a actualizar la Web App
                    socket.emit('respuesta-scrap', "Se guardo el registro correctamente")
                    log.info("Se guardo scrap")

                }).catch(function(err) {

                    // TODO: Agregar que se cierre la conexion cuando halla un catch para todas las promesas a la DB y mostrar lo que paso
                    promisePool.releaseConnection(connection)

                    

                    socket.emit('respuesta-scrap', "Se a producido un error, vuelve a intentar mas tarde")
                    log.error("Se produjo un error al guardar el scrap " + err)
                });
            });
        });

        /*
        * Pruebas para Cedar Logistics
        */

        // Mandar accounts
        socket.on('accounts', function (json) {
            var accounts = '{"users": [{"id": 1, "name": "Daniel", "password": "4rv1z0", "type": 1 }, {"id": 2, "name": "Roger", "password": "r0g3r", "type": 1 }, {"id": 3, "name": "Ricardo", "password": "R1c4rd0", "type": 2 }, {"id": 4, "name": "Miguel", "password": "sdasfg", "type": 2 }, {"id": 5, "name": "Nuvia", "password": "Nuvi4", "type": 3 }, {"id": 6, "name": "Carlos", "password": "Ch4rl1", "type": 3 }] }'
        
          socket.emit('accounts',accounts);
        });

        //Mandar assets
        socket.on('assets', function (json) {
            var assets = '{"trucks": [{"id": 1, "name": "truck 1", "mi": 13500 }, {"id": 2, "name": "truck 2", "mi": 5200 },{"id": 3, "name": "truck 3", "mi": 24500 }, {"id": 4, "name": "truck 4", "mi": 34050 }], "trailers": [{"id": 1, "name": "trailer 1"}, {"id": 2, "name": "trailer 2"},{"id": 3, "name": "trailer 3"}, {"id": 4, "name": "trailer 4"}] }' 
        
          socket.emit('assets',assets);
        });

        // Se seleccionaron los assets
        socket.on('selected-asset', function (json) {   
          socket.emit('selected-asset','{"received": true}');
        });

        // activo
        socket.on('active', function (json) {
          socket.emit('active','{"received": true}');
        });

        // inactivoi
        socket.on('inactive', function (json) {
          socket.emit('inactive','{"received": true}');
        });

        // se mando el contenido del tms
        socket.on('tms', function (json) {
            var tms ='{"id":1, "ticket":1, "tms":"75738501", "client":"HALLIBURTON", "substatus":0, "facility":"RANGELAND", "pick-date":"2018/04/25 22:00:00", "location":"vanesa", "location-lat":"28.8377425761346", "location-long":"-105.91232550797594", "drop-date":"2018/04/26 22:00:00", "product":"50-59", "weight":"", "miles":85, "load-rate":502.75, "currency":"USD", "sand-type":"100 Mesh", "po":"", "bol":"", "base":"", "silo":"", "notes":"Sin notas"}'
        
          socket.emit('tms',tms);
        });

        // se recibio un status
        socket.on('status', function (json) {
          socket.emit('status', json);
        });
        
        // Aqui puedo ir agregando mas sockets
    });
};

