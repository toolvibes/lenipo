from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.value_suggestion import ValueSuggestion
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    field: str,
    prefix: str | Unset = '',
    limit: int | Unset = 15,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["field"] = field

    params["prefix"] = prefix

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/search/suggestions",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[ValueSuggestion]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = ValueSuggestion.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[ValueSuggestion]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    field: str,
    prefix: str | Unset = '',
    limit: int | Unset = 15,

) -> Response[Problem | list[ValueSuggestion]]:
    """ Suggest stored values for a TQL field

     For autocompletion: `value` is the canonical text to put into the query.

    Args:
        field (str):
        prefix (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 15.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[ValueSuggestion]]
     """


    kwargs = _get_kwargs(
        field=field,
prefix=prefix,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    field: str,
    prefix: str | Unset = '',
    limit: int | Unset = 15,

) -> Problem | list[ValueSuggestion] | None:
    """ Suggest stored values for a TQL field

     For autocompletion: `value` is the canonical text to put into the query.

    Args:
        field (str):
        prefix (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 15.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[ValueSuggestion]
     """


    return sync_detailed(
        client=client,
field=field,
prefix=prefix,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    field: str,
    prefix: str | Unset = '',
    limit: int | Unset = 15,

) -> Response[Problem | list[ValueSuggestion]]:
    """ Suggest stored values for a TQL field

     For autocompletion: `value` is the canonical text to put into the query.

    Args:
        field (str):
        prefix (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 15.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[ValueSuggestion]]
     """


    kwargs = _get_kwargs(
        field=field,
prefix=prefix,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    field: str,
    prefix: str | Unset = '',
    limit: int | Unset = 15,

) -> Problem | list[ValueSuggestion] | None:
    """ Suggest stored values for a TQL field

     For autocompletion: `value` is the canonical text to put into the query.

    Args:
        field (str):
        prefix (str | Unset):  Default: ''.
        limit (int | Unset):  Default: 15.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[ValueSuggestion]
     """


    return (await asyncio_detailed(
        client=client,
field=field,
prefix=prefix,
limit=limit,

    )).parsed
