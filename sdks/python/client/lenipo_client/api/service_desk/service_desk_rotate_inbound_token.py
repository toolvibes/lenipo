from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.inbound_token import InboundToken
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/projects/{key}/service-desk/inbound-token".format(key=quote(str(key), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> InboundToken | Problem:
    if response.status_code == 201:
        response_201 = InboundToken.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[InboundToken | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[InboundToken | Problem]:
    """ Issue a new token for the inbound endpoint

     Switches on requests from other systems, e.g. a form on a website (E-168). The token is shown only
    now; the old one stops working at once.

    Args:
        key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[InboundToken | Problem]
     """


    kwargs = _get_kwargs(
        key=key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,

) -> InboundToken | Problem | None:
    """ Issue a new token for the inbound endpoint

     Switches on requests from other systems, e.g. a form on a website (E-168). The token is shown only
    now; the old one stops working at once.

    Args:
        key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        InboundToken | Problem
     """


    return sync_detailed(
        key=key,
client=client,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[InboundToken | Problem]:
    """ Issue a new token for the inbound endpoint

     Switches on requests from other systems, e.g. a form on a website (E-168). The token is shown only
    now; the old one stops working at once.

    Args:
        key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[InboundToken | Problem]
     """


    kwargs = _get_kwargs(
        key=key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,

) -> InboundToken | Problem | None:
    """ Issue a new token for the inbound endpoint

     Switches on requests from other systems, e.g. a form on a website (E-168). The token is shown only
    now; the old one stops working at once.

    Args:
        key (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        InboundToken | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,

    )).parsed
