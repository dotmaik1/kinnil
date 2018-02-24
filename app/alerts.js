/*
* Aqui estan definidas las alertas con crontab
* Cada 30 60 90 y 180 minutos
*/
var moment = require('moment-timezone');
var mysql = require('mysql');
var promiseMysql = require('promise-mysql');
var dbconfig = require('../config/database');

var promisePool = promiseMysql.createPool(dbconfig.connection);
promisePool.query('USE ' + dbconfig.database); 

var nodemailer = require('nodemailer');


module.exports = function(cron) {
    
    var uno, dos, tres, cuatro = true

    cron.schedule('*/1 * * * *', function(){

        console.log("un minuto")
        var events = getEvents(15)
        var emails = getEmails(1)
        if (events != "" && emails != "" && uno) {
            sendEmail(events, emails, 15)
            uno = false
        }
        if (events == "") {
            uno = true
        }
    });

    cron.schedule('*/2 * * * *', function(){

        console.log("dos minuto")
        var events = getEvents(30)
        var emails = getEmails(2)
        if (events != "" && emails != "" && dos) {
            sendEmail(events, emails, 30)
            dos = false
        }
        if (events == "") {
            dos = true
        }
    });

    cron.schedule('*/3 * * * *', function(){

        console.log("tres minuto")
        var events = getEvents(60)
        var emails = getEmails(3)
        if (events != "" && emails != "" && tres) {
            sendEmail(events, emails, 60)
            tres = false
        }
        if (events == "") {
            tres = true
        }
    });

    cron.schedule('*/4 * * * *', function(){

        console.log("cuatro minuto")
        var events = getEvents(180)
        var emails = getEmails(4)
        if (events != "" && emails != "" && cuatro) {
            sendEmail(events, emails, 180)
            cuatro = false
        }
        if (events == "") {
            cuatro = true
        }
    });

};

/*
* El intervalo sera tratado en minutos
*/
function getEvents(interval) {
    promisePool.getConnection().then(function(connection) {
        connection.query("select e1.id as id, \
        e1.maquinas_id as maquina, \
        m.nombre as nombre, \
        r.nombre as razon, \
        p.nombre as producto, \
        e1.razones_paro_id, \
        e1.productos_id, \
        e1.activo, \
        (concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora)) fecha_y_hora_evento, \
        (DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL " + interval + " minute)) fecha_y_hora_del_evento_mas_30_minutos, \
        (CONVERT_TZ(now(),'+00:00','America/Chihuahua')) Hora_actual \
        from eventos2 as e1 \
        INNER JOIN ( \
          select maquinas_id, MAX(id) as id \
          from eventos2 \
          where activo is not NULL \
          group by maquinas_id) as e2 \
        on e1.id = e2.id \
        inner join razones_paro r on e1.razones_paro_id = r.id \
        inner join productos p on e1.productos_id = p.id \
        inner join maquinas m on e1.maquinas_id = m.id \
        where DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL " + interval + " minute) <= (CONVERT_TZ(now(),'+00:00','America/Chihuahua'))")

        .then(function(rows){

            promisePool.releaseConnection(connection);
            return rows

        }).catch(function(err) {
            return ""
            log.error("Error al obtener los eventos del intervalo" + err)
        });
    });
}

/*
* Recibe el nivel para filtrar a los usuarios a los que les enviaremos correo
*/
function getEmails(nivel) {
    promisePool.getConnection().then(function(connection) {
        connection.query("select * from users where nivel = " + nivel)
        .then(function(rows){

            promisePool.releaseConnection(connection);
            return rows

        }).catch(function(err) {
            return ""
            log.error("Error al obtener los usuarios para mandar un correo" + err)
        });
    });
}


// TODO: Hacer la incercion de emails un campo obligatorio y que tiene que estar bien desde un principio
/*
* Se recibe email, eventos e intervalos para mandar el correo
*/
function sendEmail(events, emails, interval) {

    var email_list = []
    for (var x=0; x <= emails.length; x++) {
        email_list.push(email[x].email)
    }

    for (var x=0; x <= events.length; x++) {
        var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
                user: 'dotmaik1@gmail.com',
                pass: 'Fundable7riples'
            }
        });
    
        const mailOptions = {
            from: 'dotmaik1@gmail.com', // sender address
            to: email_list, // list of receivers
            subject: 'Informacion importante Kinnilweb', // Subject line
            html: '<p>La maquina: ' + events[x].name + ' tiene ' + interval + ' minutos detenida</p>'// plain text body
        };
    
        transporter.sendMail(mailOptions, function (err, info) {
            if(err)
                console.log(err)
            else
                console.log(info);
        });
    }
        
}