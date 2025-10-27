const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");

const express = require("express");
const serverless = require("serverless-http");


const app = express();
app.use(express.json());

//Método para hola mundo
app.get("/hello", async (req, res) => {
  res.status(200).json({ "Confirmación": "El programa se esta ejecutando." });
})

const USER_TABLE = process.env.USER_TABLE;
const ITEM_TABLE = process.env.ITEM_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

/* ********** MÉTODOS PARA USUARIOS  *************/
//OBTENER TODOS LOS USUARIOS
app.get("/users", async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: USER_TABLE });
    const { Items } = await docClient.send(command);
    res.status(200).json(Items);
  } catch (error) {
    console.log("Error: " + error);
    res.status(500).json({ "Error": "No se pudieron obtener todos los usuarios" });
  }
});

//MODIFICAR UN USUARIO
app.put("/users/:userId", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ "Error": "No se encuentran los datos para actualizar" });

  const params = {
    TableName: USER_TABLE,
    Key: { userId: req.params.userId },
    UpdateExpression: "SET #name = :name",
    ExpressionAttributeNames: { "#name": "name" },
    ExpressionAttributeValues: { ":name": name },
    ReturnValues: "ALL_NEW",
    ConditionExpression: "attribute_exists(userId)"   // <- corregido
  };

  try {
    const command = new UpdateCommand(params);
    const result = await docClient.send(command);
    res.status(200).json(result.Attributes);
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return res.status(404).json({ error: "Usuario no existe" });
    }
    console.log("Error " + error);
    res.status(500).json({ "Error": "No se pudo editar" });
  }
});

//ELIMINAR UN USUARIO
app.delete("/users/:userId", async (req, res) => {
  const params = {
    TableName: USER_TABLE,
    Key: {
      userId: req.params.userId,
    },
  };
  try {
    const command = new DeleteCommand(params);
    await docClient.send(command);
    res.status(200).json({ "Mensaje": "Usuario eliminado con exito" });
  } catch (error) {
    console.log("Error: " + error);
    res.status(400).json({ "Error: ": "No se puede eliminar usuario" });
  }
})

//OBTENER UN USUARIO POR ID
app.get("/users/:userId", async (req, res) => {
  const params = {
    TableName: USER_TABLE,
    Key: {
      userId: req.params.userId,
    },
  };
  try {
    const command = new GetCommand(params);
    const { Item } = await docClient.send(command);
    if (Item) {
      const { userId, name, email } = Item;
      res.json({ userId, name, email });
    } else {
      res
        .status(404)
        .json({ error: 'Could not find user with provided "userId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve user" });
  }
});

//INGRESAR UN NUEVO USUARIO
app.post("/users", async (req, res) => {
  const { userId, name, email } = req.body;
  if (typeof userId !== "string") return res.status(400).json({ "Error": "userId must be a string" });
  if (typeof name !== "string")   return res.status(400).json({ "Error": "name must be a string" });
  if (typeof email !== "string")  return res.status(400).json({ "Error": "email must be a string" });

  try {
    await docClient.send(new PutCommand({ TableName: USER_TABLE, Item: { userId, name, email } }));
    res.status(201).json({ userId, name, email });
  } catch (error) {
    console.log("error: " + error);
    res.status(500).json({ error: "Could not create user" });
  }
});
/* ********** FÍN MÉTODOS PARA USUARIOS  *************/

/* ********** MÉTODOS PARA ITEMS  *************/

//Obtener todos los ITEMS
app.get("/items", async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: ITEM_TABLE });
    const { Items } = await docClient.send(command);
    res.status(200).json(Items);
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "No se pudieron obtener los items" });
  }
});


//oBTENER UN ITEM POR ID
app.get("/items/:itemId", async (req, res) => {
  const params = {
    TableName: ITEM_TABLE,
    Key: {
      itemId: req.params.itemId,
    },
  };

  try {
    const command = new GetCommand(params);
    const { Item } = await docClient.send(command);
    if (Item) {
      const { itemId, name, price, description, userId } = Item;
      res.json({ itemId, name, price, description, userId });
    } else {
      res
        .status(404)
        .json({ error: 'Could not find item with provided "itemId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve item" });
  }
});

//Ingresar un nuevo Item
app.post("/items", async (req, res) => {
  const { itemId, name, price, description, userId } = req.body;
  if (typeof itemId !== "string")      return res.status(400).json({ error: '"itemId" must be a string' });
  if (typeof name !== "string")        return res.status(400).json({ error: '"name" must be a string' });
  if (typeof price !== "number")       return res.status(400).json({ error: '"price" must be a number' });
  if (typeof description !== "string") return res.status(400).json({ error: '"description" must be a string' });
  if (typeof userId !== "string")      return res.status(400).json({ error: '"userId" must be a string' });

  try {
    await docClient.send(new PutCommand({ TableName: ITEM_TABLE, Item: { itemId, name, price, description, userId } }));
    res.status(201).json({ itemId, name, price, description, userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create item" });
  }
});

//Modificar ITEMS (name y descripción - patch)
app.patch("/items/:itemId", async (req, res) => {
  const itemId = req.params.itemId;
  const allowed = ["name", "description"]; 
  const payload = Object.fromEntries(
    Object.entries(req.body).filter(([k, v]) => allowed.includes(k) && v !== undefined)
  );

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Debes enviar al menos 'name' o 'description'." });
  }

  try {

    const getCmd = new GetCommand({ TableName: ITEM_TABLE, Key: { itemId } });
    const { Item } = await docClient.send(getCmd);
    if (!Item) return res.status(404).json({ error: "Item no encontrado" });

    const updatedItem = { ...Item, ...payload };

    const putCmd = new PutCommand({ TableName: ITEM_TABLE, Item: updatedItem });
    await docClient.send(putCmd);

    res.status(200).json(updatedItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el item (patch)" });
  }
});

//MÉTODO EN CLASES PARA MODIFICAR
app.put("/items/:itemId", async (req, res) => {
  const itemId = req.params.itemId;
  const allowed = ["name", "price", "description", "userId"];
  const setParts = [];
  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      setParts.push(`${nameKey} = ${valueKey}`);
      ExpressionAttributeNames[nameKey] = key;
      ExpressionAttributeValues[valueKey] = req.body[key];
    }
  }
  if (setParts.length === 0) {
    return res.status(400).json({ error: "Debes enviar al menos un campo: name, price, description, userId." });
  }
  const params = {
    TableName: ITEM_TABLE,
    Key: { itemId },
    UpdateExpression: `SET ${setParts.join(", ")}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: "ALL_NEW",
    ConditionExpression: "attribute_exists(itemId)" // no crear si no existe
  };

  try {
    const command = new UpdateCommand(params);
    const result = await docClient.send(command);
    res.status(200).json(result.Attributes);
  } catch (error) {
    console.error(error);
    if (error?.name === "ConditionalCheckFailedException") {
      return res.status(404).json({ error: "Item no existe" });
    }
    res.status(500).json({ error: "No se pudo actualizar el item (put/update)" });
  }
});
/* ********** FIN MÉTODOS PARA ITEMS  *************/


app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

exports.handler = serverless(app);
