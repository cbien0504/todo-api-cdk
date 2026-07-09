import boto3
import os
import json
import uuid

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TODOS_TABLE_NAME')
table = dynamodb.Table(table_name)

def handler(event, context):
    print("Received event:", json.dumps(event))
    
    path = event.get('path', '')
    method = event.get('httpMethod', '')
    
    if method == 'OPTIONS':
        return make_response(200, {})
        
    path_parts = [p for p in path.strip('/').split('/') if p]
    
    try:
        if len(path_parts) == 1 and path_parts[0] == 'todos':
            if method == 'GET':
                response = table.scan()
                todos = response.get('Items', [])
                return make_response(200, todos)
                
            elif method == 'POST':
                body_str = event.get('body') or '{}'
                try:
                    body = json.loads(body_str)
                except Exception:
                    return make_response(400, {'error': 'Invalid JSON body'})
                
                title = body.get('title')
                done = body.get('done', False)
                
                if not title:
                    return make_response(400, {'error': 'Title is required'})
                
                todo_id = str(uuid.uuid4())
                item = {
                    'id': todo_id,
                    'title': title,
                    'done': bool(done)
                }
                table.put_item(Item=item)
                return make_response(201, item)
                
            else:
                return make_response(405, {'error': f'Method {method} not allowed on /todos'})
                
        elif len(path_parts) == 2 and path_parts[0] == 'todos':
            todo_id = path_parts[1]
            
            if method == 'GET':
                response = table.get_item(Key={'id': todo_id})
                item = response.get('Item')
                if not item:
                    return make_response(404, {'error': f'Todo with id {todo_id} not found'})
                return make_response(200, item)
                
            elif method == 'PUT':
                body_str = event.get('body') or '{}'
                try:
                    body = json.loads(body_str)
                except Exception:
                    return make_response(400, {'error': 'Invalid JSON body'})
                
                title = body.get('title')
                done = body.get('done')
                
                get_response = table.get_item(Key={'id': todo_id})
                if 'Item' not in get_response:
                    return make_response(404, {'error': f'Todo with id {todo_id} not found'})
                
                existing_item = get_response['Item']
                updated_title = title if title is not None else existing_item.get('title')
                updated_done = done if done is not None else existing_item.get('done', False)
                
                updated_item = {
                    'id': todo_id,
                    'title': updated_title,
                    'done': bool(updated_done)
                }
                table.put_item(Item=updated_item)
                return make_response(200, updated_item)
                
            elif method == 'DELETE':
                get_response = table.get_item(Key={'id': todo_id})
                if 'Item' not in get_response:
                    return make_response(404, {'error': f'Todo with id {todo_id} not found'})
                
                table.delete_item(Key={'id': todo_id})
                return make_response(200, {'message': f'Todo {todo_id} deleted successfully'})
                
            else:
                return make_response(405, {'error': f'Method {method} not allowed on /todos/{{id}}'})
        
        else:
            return make_response(404, {'error': 'Not Found'})
            
    except Exception as e:
        print(f"Error handling request: {str(e)}")
        import traceback
        traceback.print_exc()
        return make_response(500, {'error': 'Internal Server Error', 'details': str(e)})

def make_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        'body': json.dumps(body)
    }
