from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.board_data import BoardData
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: str,
    *,
    filters: str | Unset = UNSET,
    sprint: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["filters"] = filters

    json_sprint: str | Unset = UNSET
    if not isinstance(sprint, Unset):
        json_sprint = str(sprint)
    params["sprint"] = json_sprint


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/boards/{id}/issues".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> BoardData | Problem:
    if response.status_code == 200:
        response_200 = BoardData.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[BoardData | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    filters: str | Unset = UNSET,
    sprint: UUID | Unset = UNSET,

) -> Response[BoardData | Problem]:
    """ The board with its cards in rank order (at most 500)

     `filters` narrows with quick filters: "mine", "recent" or ids of the board’s own, combined with AND.

    Args:
        id (str):
        filters (str | Unset):
        sprint (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BoardData | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
filters=filters,
sprint=sprint,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    filters: str | Unset = UNSET,
    sprint: UUID | Unset = UNSET,

) -> BoardData | Problem | None:
    """ The board with its cards in rank order (at most 500)

     `filters` narrows with quick filters: "mine", "recent" or ids of the board’s own, combined with AND.

    Args:
        id (str):
        filters (str | Unset):
        sprint (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BoardData | Problem
     """


    return sync_detailed(
        id=id,
client=client,
filters=filters,
sprint=sprint,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    filters: str | Unset = UNSET,
    sprint: UUID | Unset = UNSET,

) -> Response[BoardData | Problem]:
    """ The board with its cards in rank order (at most 500)

     `filters` narrows with quick filters: "mine", "recent" or ids of the board’s own, combined with AND.

    Args:
        id (str):
        filters (str | Unset):
        sprint (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BoardData | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
filters=filters,
sprint=sprint,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    filters: str | Unset = UNSET,
    sprint: UUID | Unset = UNSET,

) -> BoardData | Problem | None:
    """ The board with its cards in rank order (at most 500)

     `filters` narrows with quick filters: "mine", "recent" or ids of the board’s own, combined with AND.

    Args:
        id (str):
        filters (str | Unset):
        sprint (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BoardData | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
filters=filters,
sprint=sprint,

    )).parsed
