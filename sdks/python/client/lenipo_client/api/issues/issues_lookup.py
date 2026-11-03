from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue_lookup import IssueLookup
from ...models.issue_lookup_request import IssueLookupRequest
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: IssueLookupRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issues/lookup",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[IssueLookup]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = IssueLookup.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[IssueLookup]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: IssueLookupRequest,

) -> Response[Problem | list[IssueLookup]]:
    """ Look up issues by key, for live links

     Up to 200 keys; answers only issues the caller may see. Unknown and hidden keys are both left out.

    Args:
        body (IssueLookupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[IssueLookup]]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: IssueLookupRequest,

) -> Problem | list[IssueLookup] | None:
    """ Look up issues by key, for live links

     Up to 200 keys; answers only issues the caller may see. Unknown and hidden keys are both left out.

    Args:
        body (IssueLookupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[IssueLookup]
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: IssueLookupRequest,

) -> Response[Problem | list[IssueLookup]]:
    """ Look up issues by key, for live links

     Up to 200 keys; answers only issues the caller may see. Unknown and hidden keys are both left out.

    Args:
        body (IssueLookupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[IssueLookup]]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: IssueLookupRequest,

) -> Problem | list[IssueLookup] | None:
    """ Look up issues by key, for live links

     Up to 200 keys; answers only issues the caller may see. Unknown and hidden keys are both left out.

    Args:
        body (IssueLookupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[IssueLookup]
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
