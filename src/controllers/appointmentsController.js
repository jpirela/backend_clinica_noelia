import { sequelize, Appointment, Log, Notification } from '../models/index.js';
import { Op } from 'sequelize';

export const addAppointment = async (req, res) => {
  try {
    const { appid, start_ts, end_ts, price, cli, doc, treat, pat } = req.body || {};
    if (!start_ts || !end_ts || !cli || !doc || !pat) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const n = (v) => Number(v);
    const isInt = (v) => Number.isInteger(n(v)) && n(v) >= 0;

    if (!isInt(start_ts) || !isInt(end_ts) || n(start_ts) >= n(end_ts)) {
      return res.status(400).json({ error: 'invalid_times' });
    }
    if (!isInt(cli) || !isInt(doc) || !isInt(pat)) {
      return res.status(400).json({ error: 'invalid_ids' });
    }
    if (price !== undefined && !(Number.isFinite(n(price)) && n(price) >= 0)) {
      return res.status(400).json({ error: 'invalid_price' });
    }

    // Check overlap: NOT (existing.end_ts <= new.start_ts OR existing.start_ts >= new.end_ts)
    const overlap = await Appointment.findOne({
      where: {
        doc: n(doc),
        cli: n(cli),
        active: 1,
        [Op.not]: {
          [Op.or]: [
            { end_ts: { [Op.lte]: n(start_ts) } },
            { start_ts: { [Op.gte]: n(end_ts) } },
          ]
        }
      },
      raw: true
    });
    if (overlap) return res.status(409).json({ error: 'overlap' });

    // Ensure appid
    let appidVal = appid || null;
    if (!appidVal) {
      const [rows] = await sequelize.query('SELECT IFNULL(MAX(appid),0)+1 AS next FROM `appointments`');
      appidVal = Number((rows && rows[0] && rows[0].next) || 1);
    }

    const rec = await Appointment.create({
      appid: appidVal,
      start_ts: n(start_ts),
      end_ts: n(end_ts),
      price: price ? n(price) : 0,
      cli: n(cli),
      clin: '',
      app_datetime: new Date(),
      doc: n(doc),
      docn: '',
      treat: treat ? n(treat) : 0,
      treatn: '',
      pat: n(pat),
      patn: '',
      paid: 0, active: 1, parent: 0
    });

// Log + Notification (best-effort)
    try {
      await Log.create({ msg: 'appointment_created', uid: pat, data: JSON.stringify({ appointment_id: rec.ID, doc, cli, start_ts, end_ts }) });
      await Notification.create({
        itemid: rec.ID,
        type: 'appointment_created',
        not_datetime: new Date(),
        availto: JSON.stringify(['doctor','patient']),
        availtoid: JSON.stringify([Number(doc), Number(pat)]),
        readby: JSON.stringify([]),
        data: JSON.stringify({ cli, start_ts, end_ts })
      });
    } catch (e) {
      console.error('log/notification error:', e?.message || e);
    }

    res.status(201).json({ id: rec.ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appt = await Appointment.findByPk(id);
    if (!appt) return res.status(404).json({ error: 'not_found' });

    await appt.update({ active: 0 });

await Log.create({ msg: 'appointment_deleted', uid: appt.pat, data: JSON.stringify({ appointment_id: appt.ID }) });
    await Notification.create({
      itemid: appt.ID,
      type: 'appointment_deleted',
      not_datetime: new Date(),
      availto: JSON.stringify(['doctor','patient']),
      availtoid: JSON.stringify([Number(appt.doc), Number(appt.pat)]),
      readby: JSON.stringify([]),
      data: JSON.stringify({ cli: appt.cli })
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
};

export const cancelByPhone = async (req, res) => {
  try {
    const { phone, appointment_id } = req.body || {};
    if (!phone || !appointment_id) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const { WpUsermeta } = await import('../models/index.js');
    const userMeta = await WpUsermeta.findOne({
      where: { meta_key: 'mobile', meta_value: phone },
      raw: true
    });
    if (!userMeta) return res.status(404).json({ error: 'patient_not_found' });

    const appt = await Appointment.findOne({
      where: { ID: Number(appointment_id), pat: userMeta.user_id, active: 1 },
      raw: true
    });
    if (!appt) return res.status(404).json({ error: 'appointment_not_found' });

    await Appointment.update({ active: 0 }, { where: { ID: appt.ID } });

await Log.create({ msg: 'appointment_canceled_by_phone', uid: appt.pat, data: JSON.stringify({ appointment_id: appt.ID, phone }) });
    await Notification.create({
      itemid: appt.ID,
      type: 'appointment_canceled',
      not_datetime: new Date(),
      availto: JSON.stringify(['doctor','patient']),
      availtoid: JSON.stringify([Number(appt.doc), Number(appt.pat)]),
      readby: JSON.stringify([]),
      data: JSON.stringify({ cli: appt.cli, phone })
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
};
