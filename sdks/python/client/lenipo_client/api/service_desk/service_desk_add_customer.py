from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.add_service_customer_request_type_0 import AddServiceCustomerRequestType0
from ...models.add_service_customer_request_type_1 import AddServiceCustomerRequestType1
from ...models.problem import Problem
from ...models.service_desk import ServiceDesk
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/projects/{key}/service-desk/customers".format(key=quote(str(key), safe=""),),
    }

    
    if isinstance(body, AddServiceCustomerRequestType0):
        _kwargs["json"] = body.to_dict()
    else:
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ServiceDesk:
    if response.status_code == 201:
        response_201 = ServiceDesk.from_dict(response.json())



        return response_201

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
    *,
    client: AuthenticatedClient | Client,
    body: AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1,

) -> Response[Problem | ServiceDesk]:
    """ Add a customer (person or group)

    Args:
        key (str):
        body (AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ServiceDesk]
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
    body: AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1,

) -> Problem | ServiceDesk | None:
    """ Add a customer (person or group)

    Args:
        key (str):
        body (AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ServiceDesk
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
    body: AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1,

) -> Response[Problem | ServiceDesk]:
    """ Add a customer (person or group)

    Args:
        key (str):
        body (AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ServiceDesk]
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
    body: AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1,

) -> Problem | ServiceDesk | None:
    """ Add a customer (person or group)

    Args:
        key (str):
        body (AddServiceCustomerRequestType0 | AddServiceCustomerRequestType1):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ServiceDesk
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
