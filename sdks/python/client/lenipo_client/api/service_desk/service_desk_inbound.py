from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.inbound_service_request import InboundServiceRequest
from ...models.inbound_service_response import InboundServiceResponse
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: InboundServiceRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/service-desk/inbound/{key}".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> InboundServiceResponse | Problem:
    if response.status_code == 201:
        response_201 = InboundServiceResponse.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[InboundServiceResponse | Problem]:
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
    body: InboundServiceRequest,

) -> Response[InboundServiceResponse | Problem]:
    """ File a request from another system

     Called with the token of the desk in `Authorization: Bearer <token>` (or `X-Lenipo-Token`). The
    person is found by email or gets an external account without a password, as a customer of this desk;
    answers reach them by mail. At most 10 requests per person and hour.

    Args:
        key (str):
        body (InboundServiceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[InboundServiceResponse | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: InboundServiceRequest,

) -> InboundServiceResponse | Problem | None:
    """ File a request from another system

     Called with the token of the desk in `Authorization: Bearer <token>` (or `X-Lenipo-Token`). The
    person is found by email or gets an external account without a password, as a customer of this desk;
    answers reach them by mail. At most 10 requests per person and hour.

    Args:
        key (str):
        body (InboundServiceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        InboundServiceResponse | Problem
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: InboundServiceRequest,

) -> Response[InboundServiceResponse | Problem]:
    """ File a request from another system

     Called with the token of the desk in `Authorization: Bearer <token>` (or `X-Lenipo-Token`). The
    person is found by email or gets an external account without a password, as a customer of this desk;
    answers reach them by mail. At most 10 requests per person and hour.

    Args:
        key (str):
        body (InboundServiceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[InboundServiceResponse | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: InboundServiceRequest,

) -> InboundServiceResponse | Problem | None:
    """ File a request from another system

     Called with the token of the desk in `Authorization: Bearer <token>` (or `X-Lenipo-Token`). The
    person is found by email or gets an external account without a password, as a customer of this desk;
    answers reach them by mail. At most 10 requests per person and hour.

    Args:
        key (str):
        body (InboundServiceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        InboundServiceResponse | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
