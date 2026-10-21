<?php
// Independent evaluator: no application code, only frozen SELECT projections.
$c=json_decode(file_get_contents('/eval-config/reader.json'),true,512,JSON_THROW_ON_ERROR);
$d=new mysqli('localhost',$c['user'],$c['password'],'af_fixture',3306,'/run/mysqld/mysqld.sock');
$queries=[
 'appointments'=>"SELECT id,start_datetime,end_datetime,id_users_provider,id_users_customer,id_services,is_unavailability,hash,color,status,COALESCE(notes,'') notes FROM ea_appointments ORDER BY id",
 'customers'=>"SELECT id,first_name,last_name,email,phone_number,id_roles,COALESCE(address,'') address,COALESCE(city,'') city,COALESCE(zip_code,'') zip_code FROM ea_users ORDER BY id",
 'services'=>'SELECT id,name,duration,slot_interval,price,color,is_private FROM ea_services ORDER BY id',
 'providers'=>'SELECT id_users,id_services FROM ea_services_providers ORDER BY id_users,id_services'];
$rows=[];foreach($queries as $k=>$q)$rows[$k]=$d->query($q)->fetch_all(MYSQLI_ASSOC);
$writeDenied=false;try{$d->query('UPDATE ea_services SET name=name WHERE id=-1');}catch(mysqli_sql_exception $e){$writeDenied=in_array($e->getCode(),[1044,1142],true);}
$outsideDenied=false;try{$d->query('SELECT User FROM mysql.user LIMIT 1');}catch(mysqli_sql_exception $e){$outsideDenied=in_array($e->getCode(),[1044,1142],true);}
echo json_encode(['snapshot'=>$rows,'reader_write_denied'=>$writeDenied,'reader_system_schema_denied'=>$outsideDenied,'uid'=>posix_geteuid()],JSON_THROW_ON_ERROR);
