import getCurrentLine from 'get-current-line'

import { Env } from '@/bindings'
import { nanoid } from 'nanoid'

import { Util } from '../util'

export interface INotice {
  id: string
  userId?: string
  dateCreated: string
  title: string
  issueDate: string
  audiences?: string
  folderId: string
  isNotifySent: number
  pdf?: string
}

// D1 doc: https://developers.cloudflare.com/d1/client-api
export const getById = async (env: Env, userId: string, id: string, fields?: string)
  : Promise<INotice | undefined> => {
  Util.logCurLine(getCurrentLine())
  if (id == null) throw new Error('Missing parameter: id')

  let field = fields || '*'
  const stmt = env.DB.prepare(`SELECT ${field} FROM Notices WHERE userId=? AND id=?`).bind(userId, id)
  const record: INotice = await stmt.first()
  return record
}

export const getAll = async (env: Env, userId: string, crit?: string, fields?: string, sort?: string, pageNo?: number, pageSize?: number)
  : Promise<INotice[] | undefined> => {
  Util.logCurLine(getCurrentLine())
  if (userId == null) throw new Error('Missing parameter: userId')

  let fs = fields || '*'
  let sql = `SELECT ${fs} FROM Notices WHERE userId='${userId}'`
  if (crit != null) sql += ` AND ${crit}`
  if (sort != null) sql += ` ORDER BY ${sort}`
  if (pageNo != null && pageSize != null) sql += ` LIMIT ${pageNo * pageSize},${pageSize}`
  const resp = await env.DB.prepare(sql).all()
  if (resp.error != null) throw new Error(resp.error)
  if (resp.results == null || resp.results.length === 0) return []

  let records = resp.results as [INotice]
  records.forEach(e => delete e.userId)
  return records
}

export const create = async (env: Env, userId: string, param: any)
  : Promise<INotice | undefined> => {
  Util.logCurLine(getCurrentLine())
  if (param == null) throw new Error('Missing parameters')
  if (userId == null) throw new Error('Missing parameter: userId')
  if (param.title == null) throw new Error('Missing parameter: title')
  if (param.issueDate == null) throw new Error('Missing parameter: issueDate')
  if (param.folderId == null) throw new Error('Missing parameter: folderId')
  if (param.isNotifySent == null) throw new Error('Missing parameter: isNotifySent')

  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM Users WHERE id=?').bind(param.userId).first()
  if (count == 0) throw new Error('UserId not found')

  const id: string = nanoid()
  const newRec: INotice = {
    id: id,
    userId: userId,
    dateCreated: new Date().toISOString(),
    title: param.title,
    issueDate: param.issueDate,
    audiences: param.audiences,
    folderId: param.folderId,
    isNotifySent: param.isNotifySent,
    pdf: param.pdf,
  }

  const result: any = await env.DB.prepare('INSERT INTO Notices(id,userId,dateCreated,title,issueDate,audiences,folderId,isNotifySent,pdf) VALUES(?,?,?,?,?,?,?,?,?)').bind(
    newRec.id,
    newRec.userId,
    newRec.dateCreated,
    newRec.title,
    newRec.issueDate,
    newRec.audiences,
    newRec.folderId,
    newRec.isNotifySent,
    newRec.pdf,
  ).run()
  if (!result.success) throw new Error(result)

  return newRec;
}

export const updateById = async (env: Env, id: string, param: any)
  : Promise<boolean> => {
  Util.logCurLine(getCurrentLine())
  if (id == null) throw new Error('Missing id')
  if (param == null) throw new Error('Missing parameters')

  const stmt = env.DB.prepare('SELECT * FROM Notices WHERE id=?').bind(id)
  const record: any = await stmt.first()
  if (record == null) throw new Error('Record not found')
  if (record.userId) delete record.userId

  let updValues: string[] = []
  const props = Object.getOwnPropertyNames(record)
  // let newRec: any = {}
  let values: any = []
  for (let i = 0; i < props.length; ++i) {
    let prop = props[i]
    if (param[prop] != undefined) {
      updValues.push(`${prop}=?`)
      values.push(param[prop])
    }
  }
  let sql = `UPDATE Notices SET ${updValues.join(',')} WHERE id=?`
  values.push(id)
  const result: any = await env.DB.prepare(sql).bind(...values).run()
  // console.log(result)
  if (!result.success) throw new Error(result)

  return true
}

export const deleteById = async (env: Env, id: string)
  : Promise<boolean> => {
  Util.logCurLine(getCurrentLine())
  if (id == null) throw new Error('Missing id')

  const result: any = await env.DB.prepare('DELETE FROM Notices WHERE id=?').bind(id).run()
  if (!result.success) throw new Error(result)

  return true
}

export const sendNoticeToAudiences = async (env: Env, notice: INotice): Promise<boolean> => {
  Util.logCurLine(getCurrentLine())

  if (notice.userId == null) throw new Error('error_no_userId')
  if (notice.audiences == null) throw new Error(`record_audiences_not_defined`)
  let audiences = JSON.parse(notice.audiences)

  // Get the tenants with the fcmDeviceToken
  let tenants = await Util.getTenantsFcmDeviceToken(env, notice.userId)

  // Consolidate the tenants who is matching the notice audiences
  let fcmDeviceTokens = []
  for (let i = 0; i < tenants.length; i++) {
    let tenant = tenants[i]
    if (audiences.residence) {
      if (tenant.type === 'res') {
        if (audiences.residence[tenant.role] === true) {
          fcmDeviceTokens.push(tenant.fcmDeviceToken)
          continue
        }
      }
    }
    if (audiences.carpark) {
      if (tenant.type === 'car') {
        if (audiences.carpark[tenant.role] === true) {
          fcmDeviceTokens.push(tenant.fcmDeviceToken)
          continue
        }
      }
    }
    if (audiences.shop) {
      if (tenant.type === 'shp') {
        if (audiences.shop[tenant.role] === true) {
          fcmDeviceTokens.push(tenant.fcmDeviceToken)
          continue
        }
      }
    }

    // Send the notifications via Firebase FCM
    if (fcmDeviceTokens.length > 0) {
    }
  }

  return true
}
