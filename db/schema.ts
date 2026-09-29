import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const maps=sqliteTable('atlas_maps',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()
},table=>[index('atlas_maps_owner').on(table.owner)]);
export const sessions=sqliteTable('atlas_sessions',{
 hash:text('hash').primaryKey(),owner:text('owner').notNull(),email:text('email').notNull(),name:text('name').notNull(),expires:integer('expires').notNull()
},table=>[index('atlas_sessions_expires').on(table.expires)]);
