/*
* Comunicacion para toda la apliacion con Socket.io
* Todas las paginas pueden hacer uso de estos sockets
*/

// TODO: Cambiarle el nombre a este modulo, no se puede llamar custom-engine
// load up the user model
var mysql = require('mysql');
var dbconfig = require('../config/database');
var connection = mysql.createConnection(dbconfig.connection);

// Para trabajar las timezones. Es importante a la hora de guardar los eventos
var moment = require('moment-timezone');

connection.query('USE ' + dbconfig.database);

// TODO: modificar esto, se tienen las variables para logearse a mysql en varias partes, hay que ponerlas solo en un lugar
var promiseMysql = require('promise-mysql');
promisePool = promiseMysql.createPool({
	host: 'localhost',
	user: 'root',
	password: 'FundableD0ubles',
	database: 'kinnil',
	connectionLimit: 5000
});
promisePool.query('USE ' + dbconfig.database)

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
                        var result = connection.query("select * from razones_paro where active = true and id > 1")
                        return result
                    }).then(function(rows) {
                        return_data.razones_paro = rows
                        
                        // Se separan los datos obtenidos de los queries
                        var plantas = return_data.plantas
                        var areas = return_data.areas
                        var maquinas = return_data.maquinas
                        var razones_paro =return_data.razones_paro
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
                                            json.plantas[x].areas[y].maquinas.push({"nombre": maquina.nombre, "id":maquina.id, razones: []}) // Se agrega la maquina al area en turno (4to nivel)
        
                                            for (var a = 0; a<razones_paro.length; a++){ // Se recorren todas las razones de paro
                                                var razon_paro = razones_paro[a]
        
                                                if (razon_paro.maquinas_id == maquina.id){ // Si la razon de paro pertenece a la maquina en turno 
                                                    //json.plantas[x].areas[y].maquinas[z].razones.push(razon_paro.nombre) // Se agrega la razon de paro a la maquina en turno (5to nivel)
                                                    json.plantas[x].areas[y].maquinas[z].razones.push({"nombre": razon_paro.nombre, "id":razon_paro.id }) // Se agrega la razon de paro a la maquina en turno (5to nivel)
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
                        io.emit('config', JSON.stringify(json)); // se manda el contenigo a las tablets como un string
                    }).catch(function(err) {
                        console.log(err);
                    });
                });
            }
        });

        socket.on('evento2', function (message) {
            console.log(message)
        });

        // TODO: Hay que hacer otro evento donde se guarde la calidad (hay que hablar esto con Jossie para ver si es posible o si utilizamos es mismo)
        socket.on('evento', function (message) {

            console.log(message)
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

            fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('YYYY-MM-DD')
			hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('HH:mm')
                
            promisePool.getConnection().then(function(connection) {
                
                connection.query("select * from razones_paro where id = " + evento.razones_id).then(function(rows){
                    //console.log(rows)
                    //console.log(rows[0].nombre)
                    //evento.nombre = rows[0].nombre
                    //evento = JSON.stringify(evento)

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
                        productos_id: 1, // TODO: Aqui hay que hacer un query con el Id de la maquina para saber cual es el producto que se esta trabajado
                        razones_paro_id: evento.razones_id,
                        razones_calidad_id: 1 // Se guarda 1 (Pieza buena) porque aqui vamos a medir TA/TM solamente pero el campo es not null TODO: Mejorar esto
                    };

                    var result = connection.query("INSERT INTO eventos2 SET ?", save)
                    // TODO: Confirmar que se guardo la info ?
                    return result

                }).then(function(rows){

                    //return_data.plantas = rows
                    // TODO: Aqui hay que mandar la actualizacion del pedo a todos.... Hay que hacer los queries o todo lo necesario para actualizar
                    // o llamar a algo mas que lo haga
                    // TODO: probar si funciona mandarse un evento a si mismo (server-server)
                    //socket.emit('actualizar', return_data);
                    socket.emit('evento-done', evento.operacion_uuid);
                    console.log("se guardo el evento");
                    //socket.broadcast.emit('estado-actual', evento)

                }).catch(function(err) {
                    console.log(err);
                });
            });


        });

        // When the server receives a “config” type signal from the client   
        socket.on('actualizar', function (message) {
            
            var return_data = {}
            promisePool.query('USE ' + dbconfig.database) // Workaround al problema de no database selected
            promisePool.getConnection().then(function(connection) {
                // TODO: hay que hacer 
                // TODO: Agregar algunas funciones para que no varie el timezone... (convertirlo)
                var d = new Date()
                var h = d.getHours()
                var m = d.getMinutes()
                var s = d.getSeconds()
                var horaActual = h + ":" + m + ":" + s
                console.log(horaActual)

                fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('YYYY-MM-DD')
                hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('HH:mm')
                
                console.log(fecha + " " + hora)
    
    
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
                    
                    // TA, TM, Disponibillidad Real, Sin disponibilidad Meta. Agrupado por maquina
                    // TODO: A todos los queries hay que quitar los enters y \ porque traducidos se ven asi select e.maquinas_id maquina, \t\t\t\tsum(e.valor) piezas, \t\t\t\tsum(e.tiempo) tiempo, \t\t\t\tsum(e.valor)...
                    var result = connection.query("select maquinas_id, sum(case when activo=1 then tiempo else 0 end) ta, \
                    sum(case when activo=0 then tiempo else 0 end) tm, \
                    (sum(case when activo=1 then tiempo else 0 end) * 100) / (sum(case when activo=1 then tiempo else 0 end) + sum(case when activo=0 then tiempo else 0 end)) disponibilidad  \
                    from eventos2 e \
                    where e.fecha = CAST('" + fecha + "' as date) \
                    and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) \
                    and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time) \
                    group by maquinas_id") 
                    return result
                }).then(function(rows){
                    return_data.disponibilidad = rows
                    // TODO: Agrer el active = 1 a todos estos queries para evitar informacion inutil
                    // Informacion agrupada por maquina (id del eventos2, activo, razon, producto, maquina)
                    var result = connection.query("select e.maquinas_id as maquina, e.id as id, e.activo as activo, r.nombre as razon, p.nombre as producto \
                    from (SELECT maquinas_id, max(id) as id \
                        FROM eventos2 \
                        group by maquinas_id) as x \
                    inner join eventos2 e on x.id = e.id \
                    inner join razones_paro r on r.id = e.razones_paro_id \
                    inner join productos p on e.productos_id = p.id \
                    where e.fecha = CAST('" + fecha + "' as date) \
                    and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"' as time) \
                    and e.hora < CAST('"+ return_data.turnoActual[0].fin +"' as time)") 
                        
                    return result
                }).then(function(rows){ 
                    return_data.estado = rows
                    // TODO: Estos queries cuando no regresan filas en el template ejs me aparece como undefined y no se despliega un buen resultado
                    // Rendimiento agrupado por maquina
                    var result = connection.query("select e.maquinas_id maquina, \
                    sum(e.valor) piezas, \
                    sum(e.tiempo) tiempo, \
                    sum(e.valor)/(sum(e.tiempo)/60/60) 'real', \
                    (sum(e.valor)/(sum(e.tiempo)/60/60))/p.rendimiento rendimiento \
                    from eventos2 e \
                    inner join productos p on e.productos_id = p.id \
                    where e.fecha = CAST('" + fecha + "' as date) \
                    and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"','%H:%i:%s') \
                    and e.hora < CAST('"+ return_data.turnoActual[0].fin +"','%H:%i:%s') \
                    group by e.maquinas_id") 
                    return result
                }).then(function(rows){ 
                    return_data.rendimiento = rows
    
                    // Calidad agrupada por maquina
                    // TODO: le falta guiarce con el turno actual. etc
                    var result = connection.query("select e.maquinas_id id, sum(e.valor) calidad\
                    from eventos2 e \
                    where e.fecha = CURDATE() \
                    and e.hora >= CAST('"+ return_data.turnoActual[0].inicio +"','%H:%i:%s') \
                    and e.hora < CAST('"+ return_data.turnoActual[0].fin +"','%H:%i:%s') \
                    group by e.maquinas_id")
                    connection.release();
                    return result
                }).then(function(rows) {
                    return_data.calidad = rows
    
                    console.log(return_data)
                    // Boradcast emite un mensaje a todos menos al que lo mando a llamar
                    socket.broadcast.emit('actualizar', return_data);

                }).catch(function(err) {
                    console.log(err);
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
            console.log("alguien se desconecto por " + reason);
            socket.emit('desconectado', "se desconecto una tablet")
        });


        // TODO: Elimiar este metodo 
        // Pruebas para analizar y solucionar las timezones
        socket.on('tiempo', function (message) {

            var today = new Date();
            var dd = today.getDate();

            console.log(today)
            
            var mm = today.getMonth()+1; 
            var yyyy = today.getFullYear();
            if(dd<10) 
            {
                dd='0'+dd;
            } 
            
            if(mm<10) 
            {
                mm='0'+mm;
            }
            today = yyyy+'-'+mm+'-'+dd;
            //console.log(today);
            //today = mm+'/'+dd+'/'+yyyy;
            //console.log(today);
            //today = dd+'-'+mm+'-'+yyyy;
            //console.log(today);
            //today = dd+'/'+mm+'/'+yyyy;
            //console.log(today);

            var d = new Date()
            var h = d.getHours()
            var m = d.getMinutes()
            var s = d.getSeconds()
            var horaActual = h + ":" + m + ":" + s

            if (message == 'normal'){

                socket.emit('tiempo', today + " " + horaActual);
            }
            if (message == 'zona'){

                fecha = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('YYYY-MM-DD')
                hora = moment(today + " " + horaActual, 'YYYY-MM-DD HH:mm').tz('America/Chihuahua').format('HH:mm')
                
                socket.emit('tiempo', " " + fecha + " " + hora);
            }
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

                    // TODO: Modificar este codigo para enviarselo solo al que lo pidio, estudiar mas el funcionamiento de los sockets
                    io.emit('cambio-planta', return_data); // io.emit send a message to everione connected

                }).catch(function(err) {
                    console.log(err);
                });
            });
        });

        socket.on('reporte-disponibilidad', function (json) {
            var planta = json.planta // all | id
            var area = json.area // all | id
            var turno = json.turno // id
            var productos = json.producto // TODO: solo recibe un producto, tiene que ser un arreglo.
            var inicio = json.inicio // YYYY-MM-DD
            var fin = json.fin // YYYY-MM-DD
            var horaInicio = json.horaInicio // Este valor es recibido en segundos.
            var horaFin = json.horaFin // Este valor es recibido en segundos.
            var tipo = json.tipo // hora | producto | turno.

            // Clausula where inicial, se agregan areas para poder utiilizarlo con un JOIN para el desglose.
            // Se agrega la fecha de inicio y la fecha final, porque siempre existen estos filtros.
            var where = " WHERE e.fecha > '" + inicio + "' AND e.fecha < '" + fin + "' "

            // Si las planta no es "todas" se filtra tambien por planta ID
            if (planta != "all")
                where += " AND e.plantas_id =" + planta

            // Si el area no es "todas" se filtra tambien por area ID
            if (area != "all") 
                where += " AND e.areas_id =" + area
            // TODO: hay que tener cuidado con el noturno y el noproductos, esto pasa cuando la planta no contiene turnos o productos

            var turnosQuery = ""
            if (turno == "noturnos"){
                turnosQuery = "select * from turnos" // Workaround por si no hay turnos
            } else {
                turnosQuery = "select * from turnos where id =" + turno // Se agrega el turno ID al query
            }

            // Si el tipo de reporte es por hora, se agrega la hora a la clausula where
            if (tipo == "hora") 
                where += " AND e.hora > SEC_TO_TIME(" + horaInicio + ") AND e.hora <  SEC_TO_TIME(" + horaFin + ") "
            

            // Si el reporte es por producto, se agrega el producto ID al where
            if (tipo == "producto") {
                // Hay que tener cuidado con el noproductos, que es cuando la planta no tiene productos---- y si quieren reportar asi que no se pueda
                // TODO Revisar esta logica, a lo mejor hay una mejor manera de hacerlo
                if (productos != "noproductos"){
                    // Solo si existe un producto es que se agrega esa seccion al query.
                    // TODO: A lo mejor cancelar el reporte y mandar una notificacion al usuario de que no se puede reportar asi
                    where += " AND productos_id = " + productos
                }
            }
    
            var return_data = {} // Guarda los datos de las promesas
            promisePool.getConnection().then(function(connection) {
                // Primero obtiene el turno actual
                // TODO: Cuando se resiven muchos eventos se empiezan a encolar hasta que se traba toda la app por los sockets
                // TODO : Poner un delay, que no puedan subir muchos sockets a la vez
                connection.query(turnosQuery).then(function(rows){
                    return_data.turnos = rows
                    
                    if (tipo == "turno"){
                        // Agrega la hora de inicio y fin a la clausula where (para cuando se busca por turno)
                        where += " AND e.hora > '" + rows[0].inicio +"' AND e.hora < '" + rows[0].fin + "' "
                        //console.log(where)
                    }

                    // Obtiene el TA
                    var result = connection.query("SELECT sum(e.tiempo) 'ta' FROM eventos2 e " + where + "  and e.activo = true") // Esta es una promesa
                    return result
                }).then(function(rows){
                    return_data.ta = rows
                    
                    // Obtiene el TM
                    var result = connection.query("SELECT sum(e.tiempo) 'tm' FROM eventos2 e " + where + "  and e.activo = false")
                    return result
                }).then(function(rows){
                    return_data.tm = rows
                    
                    // Obtiene el desglose
                    var result = connection.query("SELECT sum(e.tiempo) 'tm', r.nombre 'nombre' FROM eventos2 e JOIN razones_paro r ON e.razones_paro_id = r.id" + where + "  and e.activo = false GROUP BY r.nombre")
                    return result
                }).then(function(rows){
                    return_data.desglose = rows

                    // Emite el evento que es recibido por el cliente para graficarlo
                    io.emit('reporte-disponibilidad', return_data); // io.emit send a message to everione connected

                }).catch(function(err) {
                    console.log(err);
                });
            });
        });

        // TODO: modificar para que nos de los resultados del rendimiento (a lo mejor tiene que ser por producto, hay que revisarlo)
        socket.on('reporte-rendimiento', function (json) {
            var planta = json.planta // all | id
            var area = json.area // all | id
            var turno = json.turno // id
            var productos = json.producto // TODO: solo recibe un producto, tiene que ser un arreglo.
            var inicio = json.inicio // YYYY-MM-DD
            var fin = json.fin // YYYY-MM-DD
            var horaInicio = json.horaInicio // Este valor es recibido en segundos.
            var horaFin = json.horaFin // Este valor es recibido en segundos.
            var tipo = json.tipo // hora | producto | turno.

            // Clausula where inicial, se agregan areas para poder utiilizarlo con un JOIN para el desglose.
            // Se agrega la fecha de inicio y la fecha final, porque siempre existen estos filtros.
            var where = " WHERE e.fecha > '" + inicio + "' AND e.fecha < '" + fin + "' "

            // Si las planta no es "todas" se filtra tambien por planta ID
            if (planta != "all")
                where += " AND e.plantas_id =" + planta

            // Si el area no es "todas" se filtra tambien por area ID
            if (area != "all") 
                where += " AND e.areas_id =" + area
            // TODO: hay que tener cuidado con el noturno y el noproductos, esto pasa cuando la planta no contiene turnos o productos

            var turnosQuery = ""
            if (turno == "noturnos"){
                turnosQuery = "select * from turnos" // Workaround por si no hay turnos
            } else {
                turnosQuery = "select * from turnos where id =" + turno // Se agrega el turno ID al query
            }

            // Si el tipo de reporte es por hora, se agrega la hora a la clausula where
            if (tipo == "hora") 
                where += " AND e.hora > SEC_TO_TIME(" + horaInicio + ") AND e.hora <  SEC_TO_TIME(" + horaFin + ") "
            

            // Si el reporte es por producto, se agrega el producto ID al where
            if (tipo == "producto") {
                // Hay que tener cuidado con el noproductos, que es cuando la planta no tiene productos---- y si quieren reportar asi que no se pueda
                // TODO Revisar esta logica, a lo mejor hay una mejor manera de hacerlo
                if (productos != "noproductos"){
                    // Solo si existe un producto es que se agrega esa seccion al query.
                    // TODO: A lo mejor cancelar el reporte y mandar una notificacion al usuario de que no se puede reportar asi
                    where += " AND productos_id = " + productos
                }
            }
    
            var return_data = {} // Guarda los datos de las promesas
            promisePool.getConnection().then(function(connection) {
                // Primero obtiene el turno actual
                // TODO: Cuando se resiven muchos eventos se empiezan a encolar hasta que se traba toda la app por los sockets
                // TODO : Poner un delay, que no puedan subir muchos sockets a la vez
                connection.query(turnosQuery).then(function(rows){
                    return_data.turnos = rows
                    
                    if (tipo == "turno"){
                        // Agrega la hora de inicio y fin a la clausula where (para cuando se busca por turno)
                        where += " AND e.hora > '" + rows[0].inicio +"' AND e.hora < '" + rows[0].fin + "' "
                        //console.log(where)
                    }

                    // Obtiene el TA
                    var result = connection.query("SELECT sum(e.tiempo) 'ta' FROM eventos2 e " + where + "  and e.activo = true") // Esta es una promesa
                    return result
                }).then(function(rows){
                    return_data.ta = rows
                    
                    // Obtiene el TM
                    var result = connection.query("SELECT sum(e.tiempo) 'tm' FROM eventos2 e " + where + "  and e.activo = false")
                    return result
                }).then(function(rows){
                    return_data.tm = rows
                    
                    // Obtiene el desglose
                    var result = connection.query("SELECT sum(e.tiempo) 'tm', r.nombre 'nombre' FROM eventos2 e JOIN razones_paro r ON e.razones_paro_id = r.id" + where + "  and e.activo = false GROUP BY r.nombre")
                    return result
                }).then(function(rows){
                    return_data.desglose = rows

                    // Emite el evento que es recibido por el cliente para graficarlo
                    io.emit('reporte-rendimiento', return_data); // io.emit send a message to everione connected

                }).catch(function(err) {
                    console.log(err);
                });
            });
        });

        // TODO: modificar para que nos de los resultados del calidad (a lo mejor tiene que ser por producto, hay que revisarlo)
        socket.on('reporte-calidad', function (json) {
            var planta = json.planta // all | id
            var area = json.area // all | id
            var turno = json.turno // id
            var productos = json.producto // TODO: solo recibe un producto, tiene que ser un arreglo.
            var inicio = json.inicio // YYYY-MM-DD
            var fin = json.fin // YYYY-MM-DD
            var horaInicio = json.horaInicio // Este valor es recibido en segundos.
            var horaFin = json.horaFin // Este valor es recibido en segundos.
            var tipo = json.tipo // hora | producto | turno.

            // Clausula where inicial, se agregan areas para poder utiilizarlo con un JOIN para el desglose.
            // Se agrega la fecha de inicio y la fecha final, porque siempre existen estos filtros.
            var where = " WHERE e.fecha > '" + inicio + "' AND e.fecha < '" + fin + "' "

            // Si las planta no es "todas" se filtra tambien por planta ID
            if (planta != "all")
                where += " AND e.plantas_id =" + planta

            // Si el area no es "todas" se filtra tambien por area ID
            if (area != "all") 
                where += " AND e.areas_id =" + area
            // TODO: hay que tener cuidado con el noturno y el noproductos, esto pasa cuando la planta no contiene turnos o productos

            var turnosQuery = ""
            if (turno == "noturnos"){
                turnosQuery = "select * from turnos" // Workaround por si no hay turnos
            } else {
                turnosQuery = "select * from turnos where id =" + turno // Se agrega el turno ID al query
            }

            // Si el tipo de reporte es por hora, se agrega la hora a la clausula where
            if (tipo == "hora") 
                where += " AND e.hora > SEC_TO_TIME(" + horaInicio + ") AND e.hora <  SEC_TO_TIME(" + horaFin + ") "
            

            // Si el reporte es por producto, se agrega el producto ID al where
            if (tipo == "producto") {
                // Hay que tener cuidado con el noproductos, que es cuando la planta no tiene productos---- y si quieren reportar asi que no se pueda
                // TODO Revisar esta logica, a lo mejor hay una mejor manera de hacerlo
                if (productos != "noproductos"){
                    // Solo si existe un producto es que se agrega esa seccion al query.
                    // TODO: A lo mejor cancelar el reporte y mandar una notificacion al usuario de que no se puede reportar asi
                    where += " AND productos_id = " + productos
                }
            }
    
            var return_data = {} // Guarda los datos de las promesas
            promisePool.getConnection().then(function(connection) {
                // Primero obtiene el turno actual
                // TODO: Cuando se resiven muchos eventos se empiezan a encolar hasta que se traba toda la app por los sockets
                // TODO : Poner un delay, que no puedan subir muchos sockets a la vez
                connection.query(turnosQuery).then(function(rows){
                    return_data.turnos = rows
                    
                    if (tipo == "turno"){
                        // Agrega la hora de inicio y fin a la clausula where (para cuando se busca por turno)
                        where += " AND e.hora > '" + rows[0].inicio +"' AND e.hora < '" + rows[0].fin + "' "
                        //console.log(where)
                    }

                    // Obtiene el TA
                    var result = connection.query("SELECT sum(e.tiempo) 'ta' FROM eventos2 e " + where + "  and e.activo = true") // Esta es una promesa
                    return result
                }).then(function(rows){
                    return_data.ta = rows
                    
                    // Obtiene el TM
                    var result = connection.query("SELECT sum(e.tiempo) 'tm' FROM eventos2 e " + where + "  and e.activo = false")
                    return result
                }).then(function(rows){
                    return_data.tm = rows
                    
                    // Obtiene el desglose
                    var result = connection.query("SELECT sum(e.tiempo) 'tm', r.nombre 'nombre' FROM eventos2 e JOIN razones_paro r ON e.razones_paro_id = r.id" + where + "  and e.activo = false GROUP BY r.nombre")
                    return result
                }).then(function(rows){
                    return_data.desglose = rows

                    // Emite el evento que es recibido por el cliente para graficarlo
                    io.emit('reporte-calidad', return_data); // io.emit send a message to everione connected

                }).catch(function(err) {
                    console.log(err);
                });
            });
        });
        // Aqui puedo ir agregando mas sockets

    });
};

