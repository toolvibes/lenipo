from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.save_request_type_request import SaveRequestTypeRequest
from ...models.service_desk import ServiceDesk
from typing import cast



def _get_kwargs(
    key: str,
    id: str,
    *,
    body: SaveRequestTypeRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/service-desk/request-types/{id}".format(key=quote(str(key), safe=""),id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ServiceDesk:
    if response.status_code == 200:
        response_200 = ServiceDesk.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ServiceDesk]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SaveRequestTypeRequest,

) -> Response[Problem | ServiceDesk]:
    """ Change a request type

    Args:
        key (str):
        id (str):
        body (SaveRequestTypeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ServiceDesk]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SaveRequestTypeRequest,

) -> Problem | ServiceDesk | None:
    """ Change a request type

    Args:
        key (str):
        id (str):
        body (SaveRequestTypeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ServiceDesk
     """


    return sync_detailed(
        key=key,
id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SaveRequestTypeRequest,

) -> Response[Problem | ServiceDesk]:
    """ Change a request type

    Args:
        key (str):
        id (str):
        body (SaveRequestTypeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ServiceDesk]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SaveRequestTypeRequest,

) -> Problem | ServiceDesk | None:
    """ Change a request type

    Args:
        key (str):
        id (str):
        body (SaveRequestTypeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ServiceDesk
     """


    return (await asyncio_detailed(
        key=key,
id=id,
client=client,
body=body,

    )).parsed
