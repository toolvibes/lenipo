from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.user_lookup import UserLookup
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    query: str | Unset = '',
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["query"] = query

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/users",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[UserLookup]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = UserLookup.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[UserLookup]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    query: str | Unset = '',
    limit: int | Unset = 20,

) -> Response[Problem | list[UserLookup]]:
    """ Find active users by name or email

     Requires the global permission `browse-users`.

    Requires the global permission `browse-users`.

    Args:
        query (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[UserLookup]]
     """


    kwargs = _get_kwargs(
        query=query,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    query: str | Unset = '',
    limit: int | Unset = 20,

) -> Problem | list[UserLookup] | None:
    """ Find active users by name or email

     Requires the global permission `browse-users`.

    Requires the global permission `browse-users`.

    Args:
        query (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[UserLookup]
     """


    return sync_detailed(
        client=client,
query=query,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    query: str | Unset = '',
    limit: int | Unset = 20,

) -> Response[Problem | list[UserLookup]]:
    """ Find active users by name or email

     Requires the global permission `browse-users`.

    Requires the global permission `browse-users`.

    Args:
        query (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[UserLookup]]
     """


    kwargs = _get_kwargs(
        query=query,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    query: str | Unset = '',
    limit: int | Unset = 20,

) -> Problem | list[UserLookup] | None:
    """ Find active users by name or email

     Requires the global permission `browse-users`.

    Requires the global permission `browse-users`.

    Args:
        query (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[UserLookup]
     """


    return (await asyncio_detailed(
        client=client,
query=query,
limit=limit,

    )).parsed
