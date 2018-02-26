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

    // TODO: Hay que corregir, el problema es que estas utilizando promesas y el codigo que esta abajo llega primero que la promesa, dam Pump encontraste el problema Mike
    cron.schedule('*/1 * * * *', function(){
        getEvents("15", 1)

    });

    cron.schedule('*/2 * * * *', function(){
        getEvents("30", 2)

    });

    cron.schedule('*/3 * * * *', function(){
        getEvents("60", 3)

    });

    cron.schedule('*/4 * * * *', function(){
        getEvents("180", 4)
    });

};

/*
* El intervalo sera tratado en minutos
*/
function getEvents(interval, nivel) {

    var return_data = {}

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
        (CONVERT_TZ(now(),'+00:00','America/Chihuahua')) Hora_actual, \
        SEC_TO_TIME((TIMESTAMPDIFF(MINUTE , concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), CONVERT_TZ(now(),'+00:00','America/Chihuahua') ))*60) dieferencia_de_tiempo \
        from eventos2 as e1 \
        INNER JOIN ( \
          select maquinas_id, MAX(id) as id \
          from eventos2 \
          where activo is not NULL \
          and razones_paro_id != 1 \
          and razones_paro_id != 200 \
          and razones_paro_id != 201 \
          group by maquinas_id) as e2 \
        on e1.id = e2.id \
        inner join razones_paro r on e1.razones_paro_id = r.id \
        inner join productos p on e1.productos_id = p.id \
        inner join maquinas m on e1.maquinas_id = m.id \
        where DATE_ADD(concat(DATE_FORMAT(e1.fecha, '%Y-%m-%d'),' ',e1.hora), INTERVAL " + interval + " minute) <= (CONVERT_TZ(now(),'+00:00','America/Chihuahua'))")
        .then(function(rows){
            return_data.eventos = rows
            var result = connection.query("select * from users where nivel = " + nivel) 

            return result
        }).then(function(rows){ 
            return_data.emails = rows
            promisePool.releaseConnection(connection);

            if (return_data.eventos.length == 0) {
                if (interval == "15")
                    uno = true
                else if (interval == "30")
                    dos = true
                else if (interval == "60") 
                    tres = true
                else if (interval == "180")
                    cuatro = true
            }

            if (nivel == '1' && uno) {
                if (return_data.eventos.length > 0 && return_data.emails.length > 0) 
                    sendEmail(return_data.eventos, return_data.emails, interval, nivel)
            }
            if (nivel == '2' && dos) {
                if (return_data.eventos.length > 0 && return_data.emails.length > 0) 
                    sendEmail(return_data.eventos, return_data.emails, interval, nivel)
            }
            if (nivel == '3' && tres) {
                if (return_data.eventos.length > 0 && return_data.emails.length > 0) 
                    sendEmail(return_data.eventos, return_data.emails, interval, nivel)
            }
            if (nivel == '4' && cuatro) {
                if (return_data.eventos.length > 0 && return_data.emails.length > 0) 
                    sendEmail(return_data.eventos, return_data.emails, interval, nivel)
            }

            if (return_data.eventos.length > 0) {
                if (interval == "15")
                    uno = false
                else if (interval == "30")
                    dos = false
                else if (interval == "60") 
                    tres = false
                else if (interval == "180")
                    cuatro = false
            }
            

        }).catch(function(err) {
            return null
            log.error("Error al obtener los eventos del intervalo" + err)
        });
    });
}

// TODO: Hacer la incercion de emails un campo obligatorio y que tiene que estar bien desde un principio
/*
* Se recibe email, eventos e intervalos para mandar el correo
*/
function sendEmail(events, emails, interval, nivel) {

    var email_list = []
    for (x=0; x < emails.length; x++) {
        console.log(emails)
        email_list.push(emails[x].email)
        console.log(email_list)
    }

    for (x=0; x < events.length; x++) {

        var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
                user: 'miguel@pidelectronics.com',
                pass: 'Mangos22'
            }
        });
    
        const mailOptions = {
            from: 'alertas@kinnilweb.com', // sender address
            to: email_list, // list of receivers
            subject: 'Kinnil Alarma de tiempo muerto nivel ' + nivel, // Subject line // TODO: Agregar el nivel de la alarma
            html: '<img src="https://gm1.ggpht.com/IGtvZi2U-EkSjAv9PA4Vmbnyqyo95rBjOaciyVzbW8KNxahysyerWpSCBq4rCh6kRuPrlVTKhVaWV3ZiU8aNrawPEg_elAXk96cywexQbYaoZsu_Chxs7NmhpMGi0nFOO5cx9pzWL-eAc9jyO-JU3a0OzmTlhVSrSJdDknIxkzBfUGo29GtyKaTy8YRACMSJHjX8ZNRmoE0BxRFOfFjddHQwHP4ECKT0fBmNIae-G5INRxwZnJQlo7Qt7PlnRECJ7EladfNYvGdOLfek2HjYRTzOBSv9dMV3yYIQNd0OaBiA3Umj7xp7cjC2AIIWVv0kZUZNIqIlRc64GN5E26-UqJyMAkAHhFunTiKcmpD_XzAXn9QjjzuPkQnDTXgDoE69hpTm_wdK4oF1H3UQfjzjwV_Q8111zhh5sAlEusz4nvdLs7pK-AuDBz2n8c3IFp5MD16zyTV0-bcLlGliW9o-Rp1xd1EMqc0WQ5ZlipNgR68OEJsFgyaaZCrpweUFDDVu_I2PbU7_2muMoPvCK7wwnjur_gXcfKlilF-5WoTsIqT_4oA7xwZ5ljLTBjd-C4vN8zqBqJpmTmn9zcHWAQBzSKa9a-c-lvNucW_n3ykXogOoreHmUdc50oox-oMvWEq9O-7bVL6-UL5sMq7j93G23loGh0UqPB-VSewN77IbWl48MCurIZ02wnmgvokf=w270-h60-l75-ft" style="float:left" height="30" width="135" class="CToWUd"> \
                    <br/> \
                    <h1>La maquina ' + events[x].nombre + ' tiene ' + events[x].dieferencia_de_tiempo + ' en el estado ' + events[x].razon + '</h1> \
                    <br/> \
                    <img src="https://gm1.ggpht.com/U0dvserT_XdOssOkOqSBFPeOzsPAOu9HZ-46mwHhMb8W3MNR3ZCwfls_-3nunguIx9xlVR55nFC9yy5MpHmlcDuAiwbfHy2gS67Tmu5A0ys8-TAZT8aSaCSCbMbJ9TvGC4YkLTUvV5pRTTtFFWc6CCpf_ggZqQpglkkBbufBjvfCSmPXt1-Tehs1SYUKe800hJkSca0_ULk3YPwtUYh6lnSiTqL0erCqAZ9sDs324iEyYfeu_Qp6-LLF23KcO4_YbvTBTtDohpWY1dYjituqmzdserDQMETN7yi0NlLVCWBuJY8bQ_B6twQZzI9MPLoFKDtRKQF9dp6LVXqx_fb4Qd2CeAykobAu1amQDAgtD-Jx3aOhxNkEIanlrj8FUfjXQ6aHdDF9_A9R1bA9vFP86YKZfVTXiPzCCwSq9ku3CNGlANzzNQd_5mvCQ0h_aN-t4c8TQM92HbK1CQJDZPDUO_87AMhoXB06SWZhIwtlrxt6aNy7t2kB-2z0V2qsmnkuTa6h8f72wf1MNLVXT5X9m9r--7o0OQ0CqUsSCt3xKQzc1p9qUiHeXLmIxFgWHWIMHpze2sRQFGvw6GPblkSBMSEKM7maeaMHX8n_dY01ihDQMplXKVggT4gOxGMr0tVmmamIhLIHd4A0fQn-5dgtGOlwfOu8tltu1Ju0eHKxqP_YCrh-UgPMkSWgoJfMlw=w320-h120-l75-ft" style="float:right" height="60" width="160" class="CToWUd">'
        };
    
        transporter.sendMail(mailOptions, function (err, info) {
            if(err)
                console.log(err)
            else
                console.log(info);
        });
    }
        
}