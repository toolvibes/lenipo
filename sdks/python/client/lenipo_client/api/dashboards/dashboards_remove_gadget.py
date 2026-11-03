from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    gadget_id: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/api/v1/dashboards/{id}/gadgets/{gadget_id}".format(id=quote(str(id), safe=""),gadget_id=quote(str(gadget_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Any | Problem:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Any | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    gadget_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Any | Problem]:
    """ Remove a gadget

    Args:
        id (str):
        gadget_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
gadget_id=gadget_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    gadget_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Any | Problem | None:
    """ Remove a gadget

    Args:
        id (str):
        gadget_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
     """


    return sync_detailed(
        id=id,
gadget_id=gadget_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: str,
    gadget_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Any | Problem]:
    """ Remove a gadget

    Args:
        id (str):
        gadget_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
gadget_id=gadget_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    gadget_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Any | Problem | None:
    """ Remove a gadget

    Args:
        id (str):
        gadget_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
     """


    return (await asyncio_detailed(
        id=id,
gadget_id=gadget_id,
client=client,

    )).parsed
