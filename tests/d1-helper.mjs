import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:'){
 const sql=new DatabaseSync(path);sql.exec(readFileSync(new URL('../drizzle/0000_productive_odin.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db={prepare(query){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}},close(){sql.close()}};return db;
}
