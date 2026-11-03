from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.attachment import Attachment
from ...models.pages_attach_body import PagesAttachBody
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: PagesAttachBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/pages/{id}/attachments".format(id=quote(str(id), safe=""),),
    }

    _kwargs["files"] = body.to_multipart()

    headers["Content-Type"] = "multipart/form-data; boundary=+++"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Attachment | Problem:
    if response.status_code == 201:
        response_201 = Attachment.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Attachment | Problem]:
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
    body: PagesAttachBody,

) -> Response[Attachment | Problem]:
    """ Attach a file to a page

     multipart/form-data with the file in the field `file`; needs the space permission `edit`. Images in
    the page text refer to attachments by id.

    Args:
        id (str):
        body (PagesAttachBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Attachment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: PagesAttachBody,

) -> Attachment | Problem | None:
    """ Attach a file to a page

     multipart/form-data with the file in the field `file`; needs the space permission `edit`. Images in
    the page text refer to attachments by id.

    Args:
        id (str):
        body (PagesAttachBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Attachment | Problem
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: PagesAttachBody,

) -> Response[Attachment | Problem]:
    """ Attach a file to a page

     multipart/form-data with the file in the field `file`; needs the space permission `edit`. Images in
    the page text refer to attachments by id.

    Args:
        id (str):
        body (PagesAttachBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Attachment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: PagesAttachBody,

) -> Attachment | Problem | None:
    """ Attach a file to a page

     multipart/form-data with the file in the field `file`; needs the space permission `edit`. Images in
    the page text refer to attachments by id.

    Args:
        id (str):
        body (PagesAttachBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Attachment | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
